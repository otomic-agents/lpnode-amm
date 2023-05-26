const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File 不存在");
}
// import BigNumber from "bignumber.js";
import { appEnv } from "../app_env"; // 这个要在最前边
appEnv.initConfig(); // 初始化基本配置
import { dataConfig } from "../data_config";
import { accountManager } from "../module/exchange/account_manager";
import { logger } from "../sys_lib/logger";
import { ICexAccountApiType } from "../interface/std_difi";
// import { formatStepSize } from "../module/exchange/utils";
import * as _ from "lodash";

appEnv.initConfig(); // 初始化基本配置

async function main() {
  await dataConfig.prepareConfigResource(); // 提前创建配置
  await accountManager.loadAccounts([
    {
      apiType: ICexAccountApiType.portfolio,
      accountId: "a001",
      exchangeName: "binance",
    },
  ]);
  setTimeout(async () => {
    const orderResult = await accountManager
      .getAccount("a001")
      ?.order.spotSell(
        "00004",
        "ETH/USDT",
        "0.007",
        undefined,
        "1785.00",
        false
      );
    logger.debug(orderResult);
  }, 1000 * 10);
}
main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    logger.error("e");
  });
