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

import { appEnv } from "./app_env"; // 这个要在最前边
appEnv.initConfig(); // 初始化基本配置
// import { dataConfig } from "./data_config";
import { Mdb } from "./module/database/mdb";
import { profit } from "./module/profit";

// @ts-ignore
const cTable = require("console.table"); //  替换console table


class Main extends App {
  public constructor() {
    super();
  }

  public async main() {
    try {
      Mdb.getInstance()
        .getMongoDb("main"); // 初始化数据库链接
      await Mdb.getInstance()
        .awaitDbConn("main");
      logger.debug(`database connection ready...`, "..");
    } catch (e) {
      logger.error("Error initializing database connection", e);
      process.exit(3);
    }
    profit.process();
  }
}


const mainIns: Main = new Main();
mainIns
  .main()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  .then(() => {
  })
  .catch((e: any) => {
    logger.error("main process error", _.get(e, "message", "message"));
  });
