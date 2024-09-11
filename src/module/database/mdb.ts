// eslint-disable-next-line @typescript-eslint/no-var-requires
import { logger } from "../../sys_lib/logger";

const mongoose = require("mongoose");
import * as _ from "lodash";
import { Connection } from "mongoose";

class Mdb {
  static instance: Mdb;
  private dbList: Map<string, any> = new Map();

  private connPromise: Map<string, any> = new Map();

  static getInstance() {
    if (!Mdb.instance) {
      Mdb.instance = new Mdb();
      return Mdb.instance;
    }
    return Mdb.instance;
  }

  public awaitDbConn(key: string) {
    return new Promise((resolve, reject) => {
      this.connPromise.set(key, (error:any, result:any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Description initial db connection
   * @date 2023/3/2 - 19:30:33
   *
   * @public
   * @param {string} key "key"
   * @returns {Connection} “”
   */
  public getMongoDb(key: string): Connection {
    if (this.dbList.get(key)) {
      // Already connected directly return
      return this.dbList.get(key);
    }
    const url = _.get(process, `_sys_config.mdb.${key}.url`, null);
    logger.debug(`start conect database ${url}`);
    if (!url) {
      logger.error(false, `configuration file not found ${key}`);
      // @ts-ignore
      console.log(process._sys_config);
      throw "configuration file not found";
    }
    const conn = mongoose.createConnection(url);
    this.dbList.set(key, conn);
    conn.__dbKey = key;
    conn.on("connected", () => {
      const connPromise = this.connPromise.get(key);
      if (connPromise) {
        connPromise(null, true);
        this.connPromise.delete(key);
      }
      logger.debug("mongoos connection succeeded");
    });
    conn.on("error", (e: any) => {
      const connPromise = this.connPromise.get(key);
      if (connPromise) {
        connPromise(e.toString(), false);
        this.connPromise.delete(key);
      }
      logger.error(false, "connection error", e);
    });
    return conn;
  }
  public getMongoDbUrl(key: string): string {
    const url = _.get(process, `_sys_config.mdb.${key}.url`, "");
    return url;
  }
}

export { Mdb };
