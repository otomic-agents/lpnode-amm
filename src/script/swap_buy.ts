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
import { formatStepSize } from "../module/exchange/utils";
import * as _ from "lodash";
import { ICexAccountApiType } from "../interface/std_difi";
appEnv.initConfig(); // 初始化基本配置

console.log(formatStepSize("0.013884994", "0.01000000"));

async function main() {
  await dataConfig.prepareConfigResource(); // 提前创建配置
  // await accountManager.init();
  await accountManager.loadAccounts([
    {
      apiType: ICexAccountApiType.portfolio,
      accountId: "a001",
      exchangeName: "binance",
    },
  ]);
  setInterval(() => {
    // logger.debug(`000`);
  }, 1000);
  setTimeout(async () => {
    // balance Test
    // const result = await accountManager
    //   .getAccount("a001")
    //   ?.balance.getAllSpotBalance();
    // logger.info(result);
    //
    // const result_01 = await accountManager
    //   .getAccount("a001")
    //   ?.balance.getSpotBalance("USDT");
    // logger.info(result_01);
    //
    // accountManager.getAccount("a001")?.balance.showSpotBalance();
    //
    // logger.debug(
    //   accountManager
    //     .getAccount("a001")
    //     ?.balance.getUsdtFutureBalance("ETH/USDT")
    // );
    // logger.debug(
    //   accountManager
    //     .getAccount("a001")
    //     ?.balance.getCoinFutureBalance("ETH/USDT")
    // );

    // logger.silly(
    //   await accountManager
    //     .getAccount("a001")
    //     ?.order.spotGetTradeMinNotional("ETH/USDT")
    // );

    // accountManager
    //   .getAccount("a001")
    //   ?.order.spotBuy("0908383", "ETH/USDT", "0.000935", undefined, true);

    // logger.silly(
    //   await accountManager
    //     .getAccount("a001")
    //     ?.order.getSpotTradeMinMax("ETH/USDT", 1800)
    // );

    // logger.silly(
    //   await accountManager
    //     .getAccount("a001")
    //     ?.order.getSpotTradeMinMaxValue("ETH/USDT")
    // );
    const orderResult = await accountManager
      .getAccount("a001")
      ?.order.spotBuy(
        "00004",
        "ETH/USDT",
        "0.007",
        undefined,
        "1785.00",
        false
      );
    logger.debug(orderResult);
  }, 3000);
}

main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    logger.error("e");
  });
