import * as _ from "lodash";
import { statusRedis } from "./redis_bus";
import { logger } from "./sys_lib/logger";
import { dataConfig } from "./data_config";
class StatusReport {
  private store: any = {};
  public init() {
    _.set(this.store, "status", "runing");
    setInterval(() => {
      _.set(this.store, "lasttime", new Date().getTime());
    }, 1000);

    setInterval(() => {
      _.set(this.store, "bridgeTokenList", dataConfig.getBridgeTokenList());
    }, 5000);

    setInterval(() => {
      _.set(this.store, "tokenList", dataConfig.getTokenList());
    });
  }
  intervalReport() {
    setTimeout(() => {
      this.storeData();
    }, 1000 * 30);
  }
  public async pendingStatus(message: string) {
    _.set(this.store, "status", "pending");
    _.set(this.store, "pendingMessage", message);
    this.store();
  }
  private async storeData() {
    const statusKey = _.get(process.env, "STATUS_KEY", undefined);
    if (!statusKey) {
      logger.error(`没有找到需要设置状态的Key`);
      return;
    }
    statusRedis
      .set(statusKey, JSON.stringify(this.store))
      .then(() => {
        //
      })
      .catch((e: any) => {
        logger.error(e);
      });
  }
}

const statusReport: StatusReport = new StatusReport();
export { statusReport };
