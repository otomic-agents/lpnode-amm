const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "env.js"));
if (envFile) {
  require("./env.js");
} else {
  console.log("env File 不存在");
}

// process.exit();
import { App } from "./app";

import { logger } from "./sys_lib/logger";
import * as _ from "lodash";
import { IBridgeTokenConfigItem, IHedgeType } from "./interface/interface";
import { appEnv } from "./app_env"; // 这个要在最前边
appEnv.initConfig(); // 初始化基本配置
import { dataConfig } from "./data_config";
import { Mdb } from "./module/database/mdb";
import { orderbook } from "./module/orderbook";
import { eventProcess } from "./event_process";
import { debugDrive } from "./debug_drive";
import { TimeSleepForever, TimeSleepMs } from "./utils/utils";
import { quotation } from "./module/quotation";
import { httpServer } from "./httpd/server";
// @ts-ignore
const cTable = require("console.table"); //  替换console table
import { accountManager } from "./module/exchange/account_manager";
import { chainBalance } from "./module/chain_balance";

import { hedgeManager } from "./module/hedge_manager";
import { systemRedisBus } from "./system_redis_bus";
import { statusReport } from "./status_report";

class Main extends App {
  private bridgeTokenList: IBridgeTokenConfigItem[] = []; // Lp上配置可以跨链的币对列表
  public constructor() {
    super();
  }

  public async main() {
    try {
      Mdb.getInstance().getMongoDb("main"); // 初始化数据库链接
      await Mdb.getInstance().awaitDbConn("main");
      logger.debug(`database connection ready...`, "..");
    } catch (e) {
      logger.error("Error initializing database connection", e);
      process.exit(1);
    }
    systemRedisBus.on("tokenReload", (msg: any) => {
      logger.info(msg);
    });
    systemRedisBus.on("configResourceUpdate", async () => {
      logger.warn(`配置被admin_panel更新，需要重启程序`);
      await TimeSleepMs(3000);
      process.exit(1);
    });
    systemRedisBus.on("bridgeUpdate", async () => {
      logger.warn(`bridgeUpdate，需要重启程序`);
      await TimeSleepMs(3000);
      process.exit(1);
    });
    await systemRedisBus.init();
    logger.info("bus init");

    await dataConfig.prepareConfigResource(); // 提前创建配置
    await dataConfig.rewriteMarketUrl();

    await httpServer.start(); // 启动web服务器组件
    try {
      // Do not start without basic configuration
      await dataConfig.syncLpConfigFromLocalDatabase(); // First get the Lp configuration from the Lp settings
    } catch (e) {
      logger.warn("目前没有获得Lp的Bridge配置.", e);
      await statusReport.pendingStatus("waiting bridge config");
      await TimeSleepForever("LpBridge配置为空,等待配置");
    }

    await dataConfig.loadConfigFromRedis(); // Load basic configuration from redis

    await TimeSleepMs(1000); // Show bridgeTokenList table
    if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
      // 当前有配置对冲信息，初始化账号信息
      logger.debug(`当前有配置对冲，开始初始化账号`);
      await accountManager.init();
    } // Initialize hedging account information
    await chainBalance.init(); // Initialize Dexchain balance

    // console.log(
    //   accountManager.getAccount("a001")?.balance.getUsdtFutureBalance("USDT")
    // );
    // console.log(
    //   accountManager.getAccount("a001")?.balance.getCoinFutureBalance("BTC")
    // );
    // 测试部分
    // await accountManager.getAccount("a001")?.balance.capitalAll(); // 查询所有的可提币对
    // await accountManager.getAccount("a001")?.balance.withdrawApply(); // 提币
    // await TimeSleepMs(1000 * 60 * 10);
    await orderbook.init(); // Initialize the Orderbook handler, Cex Orderbook
    await TimeSleepMs(1000);
    this.bridgeTokenList = dataConfig.getBridgeTokenList(); // Get cross-chain currency pairs on Lp
    await eventProcess.process(); // Subscribe and start processing business events
    hedgeManager.init();
    quotation.init(this.bridgeTokenList); // Initialize the quote program
    debugDrive.init(); // Start the local mock
    statusReport.init();
    statusReport.intervalReport();
    logger.debug(`debug drive loaded.`);
  }
}

const mainIns: Main = new Main();
mainIns
  .main()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  .then(() => {})
  .catch((e: any) => {
    logger.error("main process error", _.get(e, "message", "message"));
  });
