const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env file does not exist");
}
// import BigNumber from "bignumber.js";
import { appEnv } from "../app_env";
appEnv.initConfig();
import { dataConfig } from "../data_config";
import { logger } from "../sys_lib/logger";
import * as _ from "lodash";
import { orderbook } from "../module/orderbook/orderbook";
import { orderbookSymbolManager } from "../module/orderbook/orderbook_symbol_manager";

async function main() {
  await dataConfig.prepareConfigResource();
  orderbookSymbolManager.init();
  await orderbook.init();
  orderbook.setSymbolsManager(orderbookSymbolManager);

  setInterval(() => {
    logger.debug(
      "markets info ETH/USDT",
      orderbook.getSpotOrderbook("ETH/USDT")
    );
  }, 1000 * 10);
}
main()
  .then(() => {
    logger.debug(`run Finish`);
  })
  .catch((e) => {
    logger.error(e);
  });
