import * as _ from "lodash";
import { logger } from "./sys_lib/logger";
class AppEnv {
  public isProd(): boolean {
    const isProd = _.get(
      process.env,
      "OBRIDGE_LPNODE_DB_REDIS_MASTER_SERVICE_HOST",
      null
    );
    if (isProd != null) {
      return true;
    }
    return false;
  }
  public initConfig() {
    this.initBaseConfig();

    const appName = _.get(process.env, "APP_NAME", null);
    if (!appName) {
      logger.error("启动环境参数不正确，必须包含appName");
      process.exit(1);
    }
    _.set(process, "_sys_config.app_name", appName); // 从环境变量中设置appname
    const mongoHost = _.get(process.env, "LP_NODE_DATA_MONGO_URL", "");
    const mongoUser = _.get(
      process.env,
      "OBRIDGE_LPNODE_DB_MONGO_MASTER_SERVICE_USER",
      "root"
    );
    const mongoPass = _.get(process.env, "MONGODBPASS", "");
    // 之后是正式环境的配置 mongo
    _.set(process, "_sys_config.mdb.main", {
      url: `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:27017/lp_store?authSource=admin`,
    });
    _.set(process, "_sys_config.mdb.business", {
      url: `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:27017/businessHistory?authSource=admin`,
    });
    // "行情服务地址"
    _.set(
      process,
      "_sys_config.lp_market_host",
      _.get(process.env, "LP_MARKET_SERVICE_URL", "")
    );
    _.set(
      process,
      "_sys_config.lp_market_port",
      _.get(process.env, "LP_MARKET_SERVICE_PORT", "18080")
    );
    const adminUrl = _.get(process.env, "LP_ADMIN_PANEL_ACCESS_BASEURL", null);
    if (!adminUrl) {
      logger.error("启动环境参数不正确，必须包含adminUrl");
      process.exit(1);
    }
    _.set(process, "_sys_config.lp_host", adminUrl);
  }
  private initBaseConfig() {
    _.set(process, "_sys_config.balance_lock_expiration_time", 1000 * 60 * 15);
  }
  public GetLpAdminUrl() {
    const adminUrl = _.get(process, "_sys_config.lp_host", null);
    if (!adminUrl) {
      logger.warn("没有获取到Admin-panel的Host");
    }
    return adminUrl;
  }
}
const appEnv: AppEnv = new AppEnv();
export { appEnv };
