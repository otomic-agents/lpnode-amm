const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File  env file does not exist");
}
import { appEnv } from "../app_env";
appEnv.initConfig();
import { dataConfig } from "../data_config";
import { accountManager } from "../module/exchange/account_manager";
import { logger } from "../sys_lib/logger";

appEnv.initConfig();
async function main() {
  await dataConfig.prepareConfigResource();
  await accountManager.init();
  setTimeout(async () => {
    const result = await accountManager
      .getAccount("a001")
      ?.order.spotTradeCheck("ETH/USDT", 10, 0.005);
    logger.debug(result);
  }, 10000);
}

main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    logger.error("e");
  });
