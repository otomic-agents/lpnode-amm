const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File 不存在");
}
import BigNumber from "bignumber.js";
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
    logger.info("开始Buy___NEAR/USDT");
    const result = await accountManager
      .getAccount("a001")
      ?.order.spotBuy("C020983", "NEAR/USDT", new BigNumber(100).toString());
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