import {dataConfig} from "./data_config";
import {IEVENT_LOCK_QUOTE, IEVENT_NAME} from "./interface/event";
import {IBridgeTokenConfigItem} from "./interface/interface";
import {business} from "./module/business";
import {lockEventQueue} from "./module/event_process/lock_queue";
import {redisSub} from "./redis_bus";
import {logger} from "./sys_lib/logger";
import * as _ from "lodash";
import {systemRedisBus} from "./system_redis_bus";

class EventProcess {
  public async process() {
    systemRedisBus.on("bridgeUpdate", () => {
      this.relistenEvent();
    });
    await this.listenEvent();
    await this.startProcessQueue(); // 启动队列处理
  }

  /**
   * Description 监听所有币对的处理通道
   * @date 1/17/2023 - 9:07:19 PM
   * @todo 检查一下Lp的name
   * @private
   * @async
   * @returns {*} void
   */
  private async listenEvent(): Promise<void> {
    await this.listenAllBridge();
    redisSub.on("message", async (channel: string, message: string) => {
      try {
        await this.onMessage(message, channel);
      } catch (e) {
        logger.error(`处理来自Redis 的消息发生了错误`, e);
      }
    });
  }

  private async relistenEvent(): Promise<void> {
    logger.warn(`重新订阅事件,bridgeUpdate 事件已经发生`);
    const readySubList = _.get(redisSub, "_subList", []);
    readySubList.forEach(item => {
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
          `subscribe bridgeItem channel ${item.msmq_name} ${item.srcToken}/${item.dstToken}`,
      );
      await redisSub.subscribe(item.msmq_name);
      subList.push(item.msmq_name);
    }
    _.set(redisSub, "_subList", subList);
  }

  private startProcessQueue() {
    logger.info("开始处理Lock事件队列");
    lockEventQueue.process(async (job, done) => {
      const msg: IEVENT_LOCK_QUOTE = _.get(job, "data", undefined);
      try {
        if (!msg) {
          throw new Error(`没有从队列中拿到足够的数据`);
        }
        await business.lockQuote(msg);
      } catch (e) {
        const err: any = e;
        logger.error(`处理Lock发生了错误${err.toString()}`);
      } finally {
        done(); // 结束队列的处理
      }
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
    ];
    if (processCmdList.includes(msg.cmd)) {
      logger.debug(
          "🟩<--",
          `【${msg.cmd}】`,
          JSON.stringify(msg)
              .substring(0, 100),
      );
    }
    // 处理Cmd的主要逻辑
    try {
      if (msg.cmd === IEVENT_NAME.CMD_ASK_QUOTE) {
        await business.askQuote(msg, channel);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_LOCK_QUOTE) {
        lockEventQueue.add(msg); // 添加到Lock队列
        // await business.lockQuote(msg);
        return;
      }

      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT) {
        // 用户完成Token Lock操作后，应该要求BChain 转入 如果没有问题发送 CMD_TRANSFER_IN
        await business.onTransferOut(msg);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT_CONFIRM) {
        // 用户完成确认，代币转入 Bridge 合约时发生 , 需要调用 CMD_TRANSFER_IN_CONFIRM
        await business.onTransferOutConfirm(msg);
        return;
      }
      if (msg.cmd === IEVENT_NAME.EVENT_TRANSFER_OUT_REFUND) {
        await business.onTransferOutRefund(msg);
        return;
      }
    } catch (e) {
      logger.error(`process Event Error Cmd ${msg.cmd}`, e);
    }
  }
}

const eventProcess: EventProcess = new EventProcess();

export {eventProcess};
