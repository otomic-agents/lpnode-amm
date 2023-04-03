import { redisPub } from "../../redis_bus";
import { logger } from "../../sys_lib/logger";

class BaseEventProcess {
  protected async responseMessage(responseMsg: any, msmqName: string) {
    logger.info(
      `send message to `,
      msmqName,
      JSON.stringify(responseMsg).substr(0, 100)
    );
    await redisPub.publish(msmqName, JSON.stringify(responseMsg));
    // logger.debug(responseMsg);
  }
}
export { BaseEventProcess };
