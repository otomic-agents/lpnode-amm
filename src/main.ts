import { NestFactory, NestApplicationContext } from '@nestjs/core';
import { AppModule } from "./nestjs/app.module";
import { initSysConfig } from './config/sys.config';
import { HedgeDataService } from './nestjs/HedgeData/hedge_data.service';
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
import axios from "axios";
// @ts-ignore
// const cTable = require("console.table");
import { chainBalance } from "./module/chain_balance";
import { hedgeManager } from "./module/hedge_manager";
import { systemRedisBus } from "./system_redis_bus";
import { statusReport } from "./status_report";
import { extend_bridge_item } from "./data_config_bridge_extend";
dataConfig.setExtend(extend_bridge_item);
dataConfig.setReport(statusReport);
import { orderbookSymbolManager } from "./module/orderbook/orderbook_symbol_manager";
import { portfolioRequestManager } from "./module/exchange/cex_exchange/portfolio/request/portfolio_request";
import { HedgeDataModule } from './nestjs/hedge-data.module';
import { StatusReportModule } from './nestjs/status-report.module';
import { StatusReportService } from './nestjs/StatusReport/StatusReport.service';
import { GlobalStatus } from './global_status';

class Main {
    private async checkAdminPanel() {
        const getAdminStatus = async () => {
            logger.debug("get admin panel service status ...");
            const lpAdminPanelUrl = appEnv.GetLpAdminUrl();
            const result = await axios.request({
                url: `${lpAdminPanelUrl}/link`,
                method: "get",
            });
            if (_.get(result, "data.code", -1) === 0) {
                return true;
            }
            return false;
        };
        for (; ;) {
            try {
                const ready = await getAdminStatus();
                if (ready === true) {
                    break;
                }
            } catch (e) {
                logger.error(e);
            }
            logger.info("admin panel service is not yet ready, continue waiting.");
            await TimeSleepMs(5000);
        }
    }

    public async main() {
        await this.initMongodb();
        await this.listenEvent();
        await this.checkAdminPanel();
        const hedgeDataApp = await NestFactory.createApplicationContext(HedgeDataModule);
        const statusReportApp = await NestFactory.createApplicationContext(StatusReportModule);
        const statusReportService = statusReportApp.get(StatusReportService);
        const hedgeDataService = hedgeDataApp.get(HedgeDataService);
        GlobalStatus.statusReportService = statusReportService;
        await hedgeDataApp.init();
        await dataConfig.init({
            hedgeDataService
        });
        await dataConfig.prepareConfigResource();

        httpServer.start();
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

        let userType = "exchange";
        const hedgeAccount = _.get(
            dataConfig.getBaseConfig(),
            "hedgeConfig.hedgeAccount"
        );
        const accountList = await dataConfig.getHedgeAccountList();
        accountList.forEach((item) => {
            if (item.accountId === hedgeAccount) {
                userType = item.apiType;
            }
        });

        const orderbookType = _.get(
            dataConfig.getBaseConfig(),
            "orderBookType",
            "market"
        );

        if (userType === "portfolio" || orderbookType === "portfolio") {
            logger.info(`init portfolioRequestManager`, { userType, orderbookType });
            await portfolioRequestManager.init(); // waiting get access token
        }
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

    private async initMongodb() {
        try {
            logger.debug("start main ");
            Mdb.getInstance().getMongoDb("main"); // Initialize database connection
            await Mdb.getInstance().awaitDbConn("main");
            logger.debug(`database connection ready...`, "..");
        } catch (e) {
            logger.error("Error initializing database connection", e);
            TimeSleepMs(10000);
            process.exit(0);
        }
    }

    private async listenEvent() {
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
    }
}
async function bootstrap() {
    initSysConfig();
    const app = await NestFactory.create(AppModule);
    await app.init();
    // await app.listen(3000);
}
const mainIns: Main = new Main();
mainIns
    .main()
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    .then(() => {
        bootstrap();
    })
    .catch((e: any) => {
        logger.error(e);
        logger.error("main process error", _.get(e, "message", "message"));
    });
