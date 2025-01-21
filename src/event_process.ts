import { dataConfig } from "./data_config";
import { IEVENT_LOCK_QUOTE, IEVENT_NAME } from "./interface/event";
import { IBridgeTokenConfigItem } from "./interface/interface";
import { business } from "./module/business";
import { lockEventQueue } from "./module/event_process/lock_queue";
import { redisSub } from "./redis_bus";
import { getNewRedis } from "./redis_bus";
import { logger } from "./sys_lib/logger";
import * as _ from "lodash";
import { systemRedisBus } from "./system_redis_bus";
import { channelMessageModule } from "./mongo_module/channel_message";
const util = require('util');

class SingleQueue {
  private tasks: any[];
  private isRunning: boolean;

  constructor() {
    this.tasks = [];  // Array to store tasks
    this.isRunning = false;  // Indicates whether a task is currently executing
    this.run();  // Start task processing in the constructor
  }

  // Add a task to the queue
  add(task: any) {
    this.tasks.push(task);
  }

  // Run tasks in the queue
  async run() {
    while (true) {  // Infinite loop to handle queue tasks
      if (this.tasks.length === 0) {
        this.isRunning = false;  // Mark as not running when there are no tasks
        await new Promise(resolve => setTimeout(resolve, 50));  // Brief sleep to avoid excessive CPU usage
        continue;  // Continue looping waiting for tasks
      }

      if (!this.isRunning) {
        this.isRunning = true;  // Start processing a task, mark as running
        const task = this.tasks.shift();  // Remove a task from the queue
        try {
          await task();  // Execute the task
        } catch (error) {
          console.error('Task failed:', error);
        } finally {
          this.isRunning = false;  // Reset the running flag after task completion
        }
      }
    }
  }
}
const queue = new SingleQueue();
const crypto = require("crypto");
const redis_ins = getNewRedis();
class EventProcess {
  public async process() {
    systemRedisBus.on("bridgeUpdate", () => {
      this.relistenEvent();
    });
    await this.listenEvent();
    await this.startProcessQueue(); // start process
  }

  /**
   * Description listen all bridge channel
   * @date 1/17/2023 - 9:07:19 PM
   * @private
   * @async
   * @returns {*} void
   */
  private async listenEvent(): Promise<void> {
    await this.listenAllBridge();
    redisSub.on("message", async (channel: string, message: string) => {
      try {
        this.saveMessage(message, channel)
          .then(() => {
            //
          })
          .catch((e) => {
            logger.error("write message to database error", e);
          });
        await this.onMessage(message, channel);
      } catch (e) {
        logger.error(`process redis message error`, e);
      }
    });
  }

  private async saveMessage(msg: string, channel: string) {
    const message = JSON.parse(msg);
    if (message["cmd"] === "CMD_UPDATE_QUOTE") {
      return;
    }
    await channelMessageModule.create({
      channelName: channel,
      message: JSON.parse(msg),
    });
  }

  private async relistenEvent(): Promise<void> {
    logger.warn(`resubscribe event,bridgeUpdate`);
    const readySubList = _.get(redisSub, "_subList", []);
    readySubList.forEach((item) => {
      logger.warn("unsubscribe item", item);
      redisSub.unsubscribe(item);
    });
    await this.listenAllBridge();
  }

  private async listenAllBridge() {
    const subList: string[] = [];
    await dataConfig.syncBridgeConfigFromLocalDatabase();
    const itemList: IBridgeTokenConfigItem[] = dataConfig.getBridgeTokenList();
    for (const item of itemList) {
      logger.debug(
        `subscribe bridgeItem channel ${item.msmq_name}_${item.relay_api_key} ${item.srcToken}/${item.dstToken}`
      );
      await redisSub.subscribe(item.msmq_name + "_" + item.relay_api_key);
      subList.push(item.msmq_name + "_" + item.relay_api_key);
    }
    _.set(redisSub, "_subList", subList);
  }

  private startProcessQueue() {
    logger.info("consumption queue");
    lockEventQueue.process(async (job: any, done: any) => {
      queue.add(async () => {
        const msg: IEVENT_LOCK_QUOTE = _.get(job, "data", undefined);
        try {
          if (!msg) {
            throw new Error(`no data available`);
          }
          await business.lockQuote(msg);
        } catch (e) {
          const err: any = e;
          logger.error(`execute quote job error:${err.toString()}`);
        } finally {
          done();
        }
      });
    });
  }

  public async onMessage(message: string, channel: any) {
    const msg: any = JSON.parse(message);
    // logger.debug(msg.cmd, IEVENT_NAME.EVENT_LOCK_QUOTE);
    const processCmdList = [
      IEVENT_NAME.CMD_ASK_QUOTE,
      IEVENT_NAME.EVENT_LOCK_QUOTE,
      IEVENT_NAME.EVENT_TRANSFER_OUT,
      IEVENT_NAME.EVENT_TRANSFER_OUT_CONFIRM,
      IEVENT_NAME.EVENT_TRANSFER_OUT_REFUND,
      IEVENT_NAME.EVENT_TRANSFER_IN,
      IEVENT_NAME.EVENT_TRANSFER_IN_CONFIRM,
      IEVENT_NAME.EVENT_TRANSFER_IN_REFUND,
      IEVENT_NAME.EVENT_INIT_SWAP,
      IEVENT_NAME.EVENT_CONFIRM_SWAP,
      IEVENT_NAME.EVENT_REFUND_SWAP,
    ];
    if (processCmdList.includes(msg.cmd)) {
      logger.debug(
        "📥 Message received:",
        `【${msg.cmd}】`,
        util.inspect(msg, { depth: 1, compact: true })
      );
    } else {
      logger.debug(
        "⏭️ Skipping message:",
        `【${channel}】`,
        `【${msg.cmd}】`,
        util.inspect(msg, { depth: 1, compact: true })
      );
    }

    try {
      if (msg.cmd === IEVENT_NAME.CMD_ASK_QUOTE) {
        await business.askQuote(msg, channel);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_LOCK_QUOTE) {
        lockEventQueue.add(msg);
        // await business.lockQuote(msg);
        return;
      }
      if (
        msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT ||
        msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT_CONFIRM ||
        msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT_REFUND ||
        msg.cmd === IEVENT_NAME.EVENT_INIT_SWAP ||
        msg.cmd === IEVENT_NAME.EVENT_CONFIRM_SWAP
      ) {
        const hash = crypto.createHash("md5").update(message).digest("hex");
        console.log(hash);
        const existing = await redis_ins.get(hash);
        if (existing !== null) {
          console.log("Duplicate message detected, skipping processing.");
          return;
        }
        await redis_ins.set(hash, "1", "EX", 600); // 600 sec = 10 m
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT) {
        await business.onTransferOut(msg);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT_CONFIRM) {
        await business.onTransferOutConfirm(msg);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT_REFUND) {
        await business.onTransferOutRefund(msg);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_IN) {
        await business.onTransferIn(msg);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_IN_CONFIRM) {
        await business.onTransferInConfirm(msg);
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_IN_REFUND) {
        await business.onTransferInRefund(msg);
      }

      if (msg.cmd === IEVENT_NAME.EVENT_INIT_SWAP) {
        await business.onInitSwap(msg);
      }
      if (msg.cmd === IEVENT_NAME.EVENT_CONFIRM_SWAP) {
        await business.onConfirmSwap(msg);
      }
      if (msg.cmd === IEVENT_NAME.EVENT_REFUND_SWAP) {
        await business.onRefundSwap(msg);
      }
    } catch (e) {
      logger.error(`process Event Error Cmd ${msg.cmd}`, e);
    }
  }
}

const eventProcess: EventProcess = new EventProcess();

export { eventProcess };
