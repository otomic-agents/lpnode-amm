import { logger } from "../sys_lib/logger";

const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env file does not exist");
}
import { appEnv } from "../app_env";
appEnv.initConfig();
import { Mdb } from "../module/database/mdb";
import { dataConfig } from "../data_config";
import { accountManager } from "../module/exchange/account_manager";
import { TimeSleepMs } from "../utils/utils";

async function main() {
  Mdb.getInstance().getMongoDb("main");
  await Mdb.getInstance().awaitDbConn("main");
  await dataConfig.prepareConfigResource();
  await accountManager.init();
  await TimeSleepMs(1000 * 10);
  logger.debug("execute");
  accountManager
    .getAccount("a001")
    ?.order.spotTradeCheck("ETH/USDT", 0.0001, 0.334);
}

main()
  .then()
  .catch((e: any) => {
    logger.error(e);
  });
