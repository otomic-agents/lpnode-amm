/* eslint-disable arrow-parens */
import * as _ from "lodash";

import { IStdExchange } from "../../interface/std_exchange";
import {
  ICexAccount,
  ICoinFutureBalanceItem,
  ISpotBalanceItem,
  IUsdtFutureBalanceItem,
} from "../../interface/std_difi";
import { logger } from "../../sys_lib/logger";
// @ts-ignore
const cTable = require("console.table");

class StdBalance {
  private stdExchange: IStdExchange; // cex 所的引用
  private accountInfo: ICexAccount;
  private spotBalance: Map<string, ISpotBalanceItem> = new Map();
  private usdtFutureBalance: Map<string, IUsdtFutureBalanceItem> = new Map();
  private coinFutureBalance: Map<string, ICoinFutureBalanceItem> = new Map();
  // private coinFutureBalance:Map<string ,IFutureUsdtBalanceItem> = new Map()
  public constructor(cexExchange: IStdExchange, accountInfo: ICexAccount) {
    this.stdExchange = cexExchange;
    this.accountInfo = accountInfo;
  }
  public getSpotBalance(symbol: string): ISpotBalanceItem {
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
  public getUsdtFutureBalance(
    symbol: string
  ): IUsdtFutureBalanceItem | undefined {
    return this.usdtFutureBalance.get(symbol);
  }
  public getCoinFutureBalance(symbol: string) {
    return this.coinFutureBalance.get(symbol);
  }
  public showSpotBalance() {
    this.spotBalance.forEach((item, k) => {
      console.log(k, JSON.stringify(item));
    });
  }
  public async withdrawApply() {
    return this.stdExchange.exchangeSpot.withdrawApply();
  }
  public async capitalAll() {
    return this.stdExchange.exchangeSpot.capitalAll();
  }

  /**
   * Description 同步Cex现货的余额信息,并开启定时
   * @date 1/17/2023 - 9:04:34 PM
   *
   * @public
   * @async
   * @returns {*} void
   */
  public async syncSpotBalance() {
    logger.debug(`syncSpotBalance【${this.accountInfo.accountId}】`);
    await this.stdExchange.exchangeSpot.fetchBalance();
    this.stdExchange.exchangeSpot.getBalance().forEach((v, k) => {
      this.spotBalance.set(k, v);
    });
    setTimeout(() => {
      this.syncSpotBalance();
    }, 1000 * 30);
  }
  /**
   * Description 同步U本位合约余额信息,并开启定时 ，并把数据适配为标准数据格式
   * @date 1/17/2023 - 9:04:34 PM
   *
   * @public
   * @async
   * @returns {*} void
   */
  public async syncUsdtFutureBalance() {
    logger.debug(`syncUsdtFutureBalance【${this.accountInfo.accountId}】`);
    await this.stdExchange.exchangeUsdtFuture.fetchBalance();
    this.stdExchange.exchangeUsdtFuture.getBalance().forEach((v, k) => {
      this.usdtFutureBalance.set(k, v);
    });
    setTimeout(() => {
      this.syncUsdtFutureBalance();
    }, 1000 * 30);
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
