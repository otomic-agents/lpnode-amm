import { getNewRedis } from "./redis_bus";
import { logger } from "./sys_lib/logger";
const EventEmitter = require("events").EventEmitter;
const systemRedisBusSub = getNewRedis(); // 创建一个新的redis 用于sub
const systemRedisBusPub = getNewRedis(); // 创建一个新的redis 用于sub
import * as _ from "lodash";
class SystemRedisBus extends EventEmitter {
  public async init() {
    this.listenSystemEvent().catch((e: any) => {
      logger.error("处理bus消息发生了错误", e);
    });
  }
  public async emitEvent(eventName: string, data: any) {
    try {
      await systemRedisBusPub.publish(
        "SYSTEM_REDIS_EVENT_BUS",
        JSON.stringify({
          eventName,
          payload: data,
        })
      );
    } catch (e) {
      logger.error(`发送系统事件通知发生了错误`, e);
    }
  }
  private async listenSystemEvent() {
    logger.debug(`sub system bus "SYSTEM_REDIS_EVENT_BUS"`);
    await systemRedisBusSub.subscribe("SYSTEM_REDIS_EVENT_BUS");
    systemRedisBusSub.on("message", (channel: string, msg: string) => {
      logger.debug(`收到了系统通道的消息`, channel, msg);
      const message = JSON.parse(msg);
      let eventName = _.get(message, "eventName", "");
      if (eventName === "") {
        eventName = _.get(message, "type", "");
      }
      if (eventName === "") {
        logger.warn("无法识别的通道消息", msg);
        return;
      }
      const payload = _.get(message, "payload", {});
      this.emit(eventName, payload);
    });
    logger.debug(`sub system bus "LP_SYSTEM_Notice"`);
    await systemRedisBusSub.subscribe("LP_SYSTEM_Notice");
  }
}
const systemRedisBus: SystemRedisBus = new SystemRedisBus();
export { SystemRedisBus, systemRedisBus };
