import {
  ICexAccount,
  ICexAccountApiType,
  ICexExchangeList,
} from "../../interface/std_difi";
import { IStdExchange } from "../../interface/std_exchange";
import { StdBalance } from "./std_balance";
import { BinanceExchange } from "./cex_exchange/binance/binance";
import { StdOrder } from "./std_order";
import { logger } from "../../sys_lib/logger";
import { StdInfo } from "./std_info";
import { PortfolioExchange } from "./cex_exchange/portfolio/portfolio";

import * as _ from "lodash";
class StdAccount {
  private cexExchange: IStdExchange;
  private accountInfo: ICexAccount;
  public balance: StdBalance;
  public order: StdOrder;
  public info: StdInfo;

  constructor(option: ICexAccount) {
    // logger.debug(`rewrite config to Test`);
    // _.set(option, "apiType", ICexAccountApiType.portfolio);
    // if (_.get(option, "enablePrivateStream", undefined) === undefined) {
    //   logger.debug(`set default ws option`);
    //   _.set(option, "enablePrivateStream", true);
    // }
    this.accountInfo = option;
  }
  public getCexExchange() {
    return this.cexExchange;
  }

  public getExchangeName() {
    return this.accountInfo.exchangeName;
  }

  /**
   * Initialize account list
   * @date 2023-01-17 20:51:30
   * @public
   * @async
   * @return {Promise<void>} Empty
   */
  public async init(): Promise<void> {
    if (
      this.accountInfo.exchangeName === ICexExchangeList.binance &&
      this.accountInfo.apiType === ICexAccountApiType.exchange &&
      this.accountInfo.spotAccount &&
      this.accountInfo.usdtFutureAccount &&
      this.accountInfo.coinFutureAccount
    ) {
      // 直接对接币安
      this.cexExchange = new BinanceExchange({
        spotAccount: {
          apiKey: this.accountInfo.spotAccount.apiKey,
          apiSecret: this.accountInfo.spotAccount.apiSecret,
        },
        usdtFutureAccount: {
          apiKey: this.accountInfo.usdtFutureAccount.apiKey,
          apiSecret: this.accountInfo.usdtFutureAccount.apiSecret,
        },
        coinFutureAccount: {
          apiKey: this.accountInfo.coinFutureAccount.apiKey,
          apiSecret: this.accountInfo.coinFutureAccount.apiSecret,
        },
      });
      logger.debug(
        `load exchange spot markets symbols 【${this.accountInfo.accountId}】`
      );
    }
    if (
      this.accountInfo.exchangeName === ICexExchangeList.binance &&
      this.accountInfo.apiType === ICexAccountApiType.portfolio
    ) {
      this.cexExchange = new PortfolioExchange(
        this.accountInfo.accountId,
        this.accountInfo
      );
    }
    try {
      await this.cexExchange.exchangeSpot.initMarkets(); // Initialize trading pairs in the spot market
      await this.cexExchange.exchangeUsdtFuture.initMarkets(); //  initializes trading pairs
      await this.cexExchange.exchangeCoinFuture.initMarkets(); // initializes trading pairs
      await this.initBalance(this.cexExchange);
      await this.initOrder(this.cexExchange);
      await this.initInfo(this.cexExchange); // init markets
    } catch (e) {
      const err: any = e;
      logger.error(
        `An error occurred in initializing the hedging account....`,
        err.toString()
      );
      throw new Error(
        `An error occurred in initializing the hedging account:${err.toString()}`
      );
    }
    if (!this.cexExchange) {
      throw new Error(
        `Account initialization failed:${JSON.stringify(this.accountInfo)}`
      );
    }
  }

  private async initOrder(cexExchange: IStdExchange) {
    this.order = new StdOrder(cexExchange);
  }

  private async initInfo(cexExchange: IStdExchange) {
    this.info = new StdInfo(cexExchange);
  }

  /**
   * Initialize the balance class
   * @date 1/17/2023 - 8:53:26 PM
   *
   * @private
   * @async
   * @param {IStdExchange} cexExchange "Exchange"
   * @returns {Promise<void>} ""
   */
  private async initBalance(cexExchange: IStdExchange): Promise<void> {
    this.balance = new StdBalance(cexExchange, this.accountInfo);
    await this.balance.syncSpotBalance();
    await this.balance.syncUsdtFutureBalance();
    await this.balance.syncCoinFutureBalance();
    await this.balance.syncUsdtFuturePositionRisk();
  }

  public getSpotStatus() {
    // this.cexExchange.getSpotStatus();
  }
}

export { StdAccount };
