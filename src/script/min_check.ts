const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File 不存在");
}
import { appEnv } from "../app_env"; // 这个要在最前边
appEnv.initConfig(); // 初始化基本配置
import { dataConfig } from "../data_config";
import { accountManager } from "../module/exchange/account_manager";
import { logger } from "../sys_lib/logger";

appEnv.initConfig(); // 初始化基本配置
async function main() {
  await dataConfig.prepareConfigResource(); // 提前创建配置
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
