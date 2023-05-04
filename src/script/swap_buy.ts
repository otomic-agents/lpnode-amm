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
appEnv.initConfig(); // 初始化基本配置

console.log(formatStepSize("0.013884994", "0.01000000"));

async function main() {
  await dataConfig.prepareConfigResource(); // 提前创建配置
  // await accountManager.init();
  await accountManager.loadAccounts([
    {
      accountId: "a002",
      exchangeName: "binance",
      spotAccount: {
        apiKey: "",
        apiSecret: "",
      },
      usdtFutureAccount: {
        apiKey:
          "NzhXa9logqSx3Pnaejsa9siBtAnY5wPAmpyA7WN797BCGaaPxL8uWL178oWmYOLq",
        apiSecret:
          "c8qoWHR1TwkwfoiV4lMAoa1b1AyW454jbdGzezeBKDpIG4TjIaeTtz6QtjbvGeFs",
      },
      coinFutureAccount: {
        apiKey: "",
        apiSecret: "",
      },
    },
  ]);
  setInterval(() => {
    // logger.debug(`000`);
  }, 1000);
  setTimeout(async () => {
    const result = await accountManager
      .getAccount("a002")
      ?.balance.getUsdtFutureAllPositionRisk();
    console.log(_.find(result, { symbol: "ETH-USDT-SWAP" }));
  }, 3000);
  // setTimeout(async () => {
  //   const result = await accountManager
  //     .getAccount("a002")
  //     ?.order.getUsdtFutureOrdersBySymbol("ETH/USDT");
  //   logger.debug(result);
  // }, 3000);

  // setTimeout(async () => {
  //   // logger.debug(
  //   //   accountManager.getAccount("a002")?.balance.getAllSpotBalance()
  //   // );
  //   const result = await accountManager
  //     .getAccount("a002")
  //     ?.order.swapBuy("ETH/USDT", new BigNumber(0.01));
  //   logger.debug(result);
  // }, 3000);
}

main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    logger.error("e");
  });
