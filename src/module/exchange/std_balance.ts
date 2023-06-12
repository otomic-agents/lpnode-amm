/* eslint-disable arrow-parens */
import * as _ from "lodash";

import { IStdExchange } from "../../interface/std_exchange";
import {
  ICexAccount,
  ICoinFutureBalanceItem,
  ISpotBalanceItem,
  IUsdtFutureAccountPositionsRiskItem,
  IUsdtFutureBalanceItem,
} from "../../interface/std_difi";
import { logger } from "../../sys_lib/logger";
import { exchangeRedisStore } from "./redis_store";
const yargs = require("yargs-parser");
const flags = yargs(process.argv.slice(2));
const loadTestBalance = _.get(flags, "loadTestBalance", false);
logger.debug("loadTestBalance", loadTestBalance);
// @ts-ignore
const cTable = require("console.table");

class StdBalance {
  private testBalance = {
    ETH: 10,
    USDT: 100000,
  };
  private stdExchange: IStdExchange;
  private accountInfo: ICexAccount;
  private spotBalance: Map<string, ISpotBalanceItem> = new Map();
  private usdtFutureBalance: Map<string, IUsdtFutureBalanceItem> = new Map();
  private usdtFuturePositionRisk: Map<
    string,
    IUsdtFutureAccountPositionsRiskItem
  >;
  private coinFutureBalance: Map<string, ICoinFutureBalanceItem> = new Map();

  // private coinFutureBalance:Map<string ,IFutureUsdtBalanceItem> = new Map()
  public constructor(cexExchange: IStdExchange, accountInfo: ICexAccount) {
    this.stdExchange = cexExchange;
    this.accountInfo = accountInfo;
  }

  public getSpotBalance(symbol: string): ISpotBalanceItem {
    if (symbol === "T") {
      return {
        free: "1000000",
        asset: "T",
        locked: "0",
      };
    }
    if (loadTestBalance === true) {
      // return test balance
      if (this.testBalance[symbol]) {
        return {
          free: this.testBalance[symbol].toString(),
          asset: symbol,
          locked: "0",
        };
      }
      return {
        free: "0",
        asset: symbol,
        locked: "0",
      };
    }

    const balanceItem = this.spotBalance.get(symbol);
    if (!balanceItem) {
      return {
        free: "0",
        asset: symbol,
        locked: "0",
      };
    }
    return balanceItem;
  }

  public getAllSpotBalance() {
    const itemList: { free: string; asset: string; locked: string }[] = [];
    this.spotBalance.forEach((value) => {
      itemList.push(value);
    });
    return itemList;
  }
  public showSpotBalance() {
    this.spotBalance.forEach((item, k) => {
      console.log(k, JSON.stringify(item));
    });
  }

  public getUsdtFutureBalance(
    symbol: string
  ): IUsdtFutureBalanceItem | undefined {
    return this.usdtFutureBalance.get(symbol);
  }
  public getUsdtFutureAllBalance() {
    const list: IUsdtFutureBalanceItem[] = [];
    this.usdtFutureBalance.forEach((value) => {
      list.push(value);
    });
    return list;
  }

  public getCoinFutureBalance(symbol: string) {
    return this.coinFutureBalance.get(symbol);
  }

  public async withdrawApply() {
    return;
  }

  public async capitalAll() {
    return;
  }

  /**
   * Synchronize the balance information
   * @date 1/17/2023 - 9:04:34 PM
   *
   * @public
   * @async
   * @returns {*} void
   */
  public async syncSpotBalance() {
    logger.debug(`syncSpotBalance【${this.accountInfo.accountId}】`);
    await this.stdExchange.exchangeSpot.loadBalance();
    await this.reportSpotBalance();
    this.stdExchange.exchangeSpot.getBalance().forEach((v, k) => {
      this.spotBalance.set(k, v);
    });
    setTimeout(() => {
      this.syncSpotBalance();
    }, 1000 * 30);
  }

  public async syncUsdtFuturePositionRisk() {
    await this.stdExchange.exchangeUsdtFuture.fetchPositionRisk();
    this.usdtFuturePositionRisk =
      this.stdExchange.exchangeUsdtFuture.getPositionRisk();

    for (const [key, value] of this.usdtFuturePositionRisk) {
      const redisKey =
        `${this.stdExchange.exchangeName}_PositionRisk_USDT_SWAP`.toUpperCase();
      const subKey = `${key}`.toUpperCase();
      logger.debug(redisKey, subKey);
      await exchangeRedisStore.hset(redisKey, subKey, JSON.stringify(value));
    }
    logger.debug(`syncUsdtFuturePositionRisk Complete.... Set to StdBalance`);

    setTimeout(() => {
      this.syncUsdtFuturePositionRisk().catch((e) => {
        logger.error(e);
      });
    }, 1000 * 30);
  }
  public getUsdtFutureAllPositionRisk() {
    const itemList: IUsdtFutureAccountPositionsRiskItem[] = [];
    this.usdtFuturePositionRisk.forEach((value) => {
      itemList.push(value);
    });
    // console.log(JSON.stringify(itemList));
    return itemList;
    //
  }

  private async reportSpotBalance() {
    console.log(`cex account info:`);
    const balanceList: any[] = [];
    await this.stdExchange.exchangeSpot.getBalance().forEach((item, key) => {
      balanceList.push(item);
    });
    console.table(balanceList);
  }

  /**
   * @date 1/17/2023 - 9:04:34 PM
   *
   * @public
   * @async
   * @returns {*} void
   */
  public async syncUsdtFutureBalance() {
    logger.debug(`syncUsdtFutureBalance【${this.accountInfo.accountId}】`);
    await this.stdExchange.exchangeUsdtFuture.loadBalance();
    this.stdExchange.exchangeUsdtFuture.getBalance().forEach((v, k) => {
      this.usdtFutureBalance.set(k, v);
    });
    setTimeout(() => {
      this.syncUsdtFutureBalance();
    }, 1000 * 30);
  }

  public async syncUsdtFuturePositions() {
    //
  }

  public async syncCoinFutureBalance() {
    logger.debug(`syncCoinFutureBalance【${this.accountInfo.accountId}】`);
    await this.stdExchange.exchangeCoinFuture.fetchBalance();
    this.stdExchange.exchangeCoinFuture.getBalance().forEach((v, k) => {
      this.coinFutureBalance.set(k, v);
    });
    setTimeout(() => {
      this.syncCoinFutureBalance();
    }, 1000 * 30);
  }
}

export { StdBalance };
