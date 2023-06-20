const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "env.js"));
if (envFile) {
  require("./env.js");
} else {
  console.log("env File does not exist");
}

// process.exit();

import { logger } from "./sys_lib/logger";
import * as _ from "lodash";

import { appEnv } from "./app_env";
appEnv.initConfig();

import { dataConfig } from "./data_config";
import { Mdb } from "./module/database/mdb";
import { orderbook } from "./module/orderbook/orderbook";
import { eventProcess } from "./event_process";
import { TimeSleepForever, TimeSleepMs } from "./utils/utils";
import { quotation } from "./module/quotation";
import { httpServer } from "./httpd/server";
// @ts-ignore
// const cTable = require("console.table");
import { chainBalance } from "./module/chain_balance";
import { hedgeManager } from "./module/hedge_manager";
import { systemRedisBus } from "./system_redis_bus";
import { statusReport } from "./status_report";
import { orderbookSymbolManager } from "./module/orderbook/orderbook_symbol_manager";
import { portfolioRequestManager } from "./module/exchange/cex_exchange/portfolio/request/portfolio_request";

class Main {
  public async main() {
    try {
      logger.debug("start main ");
      Mdb.getInstance().getMongoDb("main"); // Initialize database connection
      await Mdb.getInstance().awaitDbConn("main");
      logger.debug(`database connection ready...`, "..");
    } catch (e) {
      logger.error("Error initializing database connection", e);
      process.exit(3);
    }
    systemRedisBus.on("tokenReload", (msg: any) => {
      logger.warn(`skip tokenReload event`);
      logger.info(msg);
    });
    systemRedisBus.on("configResourceUpdate", async (message: any) => {
      logger.debug(message);
      if (
        _.get(message, "appName", "") !==
        _.get(process.env, "APP_NAME", undefined)
      ) {
        logger.debug(
          `Not this program's message configResourceUpdate  skip process`
        );
        return;
      }
      logger.warn(`The configuration is updated by admin_panel,need restart`);
      await TimeSleepMs(3000);
      process.exit(1);
    });
    systemRedisBus.on("bridgeUpdate", async () => {
      //
    });
    await systemRedisBus.init();
    logger.info("bus init");

    await dataConfig.prepareConfigResource();

    await httpServer.start();
    try {
      // Do not start without basic configuration
      logger.debug("loadBaseConfig");
      await dataConfig.loadBaseConfig(); // Load basic configuration from redis
      logger.debug("start syncBridgeConfigFromLocalDatabase");
      await dataConfig.syncBridgeConfigFromLocalDatabase(); // First get the Lp configuration from the Lp settings
    } catch (e) {
      logger.warn("No Bridge configuration.", e);
      await statusReport.pendingStatus("waiting bridge config");
      await TimeSleepForever(
        "LpBridge configuration is empty, waiting for configuration"
      );
    }
    /**
     * 1.load loadTokenToSymbol
     * 2.loadChainConfig
     */
    // console.dir(dataConfig.getBaseConfig(), ConsoleDirDepth5);
    // process.exit();
    let userType = "exchange";
    const hedgeAccount = _.get(
      dataConfig.getBaseConfig(),
      "hedgeConfig.hedgeAccount"
    );
    dataConfig.getHedgeAccountList().forEach((item) => {
      if (item.accountId === hedgeAccount) {
        userType = item.apiType;
      }
    });
    if (userType === "profolio") {
      logger.info(`init portfolioRequestManager`);
      await portfolioRequestManager.init(); // waiting get access token
    }

    const orderbookType = _.get(
      dataConfig.getBaseConfig(),
      "orderBookType",
      "market"
    );
    if (orderbookType === "portfolio") {
      logger.info(`portfolio orderbook model`);

      logger.info(`init orderbookSymbolManager`);
      orderbookSymbolManager.init();
    }

    await TimeSleepMs(100); // Show bridgeTokenList table
    await chainBalance.init(); // Initialize Dexchain balance
    await orderbook.init(); // Initialize the Orderbook handler, Cex Orderbook
    orderbook.setSymbolsManager(orderbookSymbolManager);
    logger.debug(`init hedgeManager`);
    await hedgeManager.init();
    logger.debug(`start eventProcess`);
    await eventProcess.process(); // Subscribe and start processing business events
    logger.debug(`init quotation`);
    await quotation.init(); // Initialize the quote program

    statusReport.init();
    statusReport.intervalReport();
  }
}

const mainIns: Main = new Main();
mainIns
  .main()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  .then(() => {})
  .catch((e: any) => {
    logger.error(e);
    logger.error("main process error", _.get(e, "message", "message"));
  });
