import * as _ from "lodash";
import { logger } from "./sys_lib/logger";
class AppEnv {
  public isProd(): boolean {
    const isProd = _.get(
      process.env,
      "OBRIDGE_REDIS_HOST",
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
      logger.error(
        "The startup environment parameters are incorrect and must contain:appName"
      );
      process.exit(1);
    }
    _.set(process, "_sys_config.app_name", appName);
    const mongoHost = _.get(process.env, "OBRIDGE_MONGODB_HOST", "");
    const mongoUser = "root";
    const mongoPass = _.get(process.env, "MONGODB_PASSWORD", "");
    _.set(process, "_sys_config.mdb.main", {
      url: `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:27017/lp_store?authSource=admin`,
    });
    _.set(process, "_sys_config.mdb.business", {
      url: `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:27017/businessHistory?authSource=admin`,
    });

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
      logger.error(
        "The startup environment parameters are incorrect and must contain:adminUrl"
      );
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
      logger.warn("can't fount admin-panel host config");
    }
    return adminUrl;
  }
}
const appEnv: AppEnv = new AppEnv();
export { appEnv };
