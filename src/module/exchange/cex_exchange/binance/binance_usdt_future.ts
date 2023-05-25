import axios from "axios";
import {
  IUsdtFutureSymbolItemBinance,
  IUsdtFutureBalanceItemBinance,
  // IOrderTypeBinance,
  IUsdtFutureAccountPositionsRiskItemBinance,
} from "../../../../interface/cex_binance";
import { logger } from "../../../../sys_lib/logger";
import { signatureObject } from "../../utils";
import * as _ from "lodash";
import { IStdExchangeUsdtFuture } from "../../../../interface/std_exchange";
import BigNumber from "bignumber.js";
import {
  ISide,
  IUsdtFutureAccountPositionsRiskItem,
  IUsdtFutureSymbolItem,
} from "../../../../interface/std_difi";
import { httpsKeepAliveAgent } from "../../../../sys_lib/http_agent";
import { binanceConfig } from "./binance_config";

class BinanceUsdtFuture implements IStdExchangeUsdtFuture {
  private apiKey: string;
  private apiSecret: string;
  private apiBaseUrl = "";
  protected symbolsInfo: Map<string, IUsdtFutureSymbolItemBinance> = new Map();
  protected balance: Map<string, IUsdtFutureBalanceItemBinance> = new Map();

  protected positionRisk: Map<string, IUsdtFutureAccountPositionsRiskItem> =
    new Map();

  constructor(accountInfo: { apiKey: string; apiSecret: string }) {
    this.apiKey = accountInfo.apiKey;
    this.apiSecret = accountInfo.apiSecret;
    this.apiBaseUrl = binanceConfig.getUsdtFutureBaseApi();
  }

  /**
   * sync account balance
   * @date 2023/5/12 - 14:16:00
   *
   * @public
   * @async
   * @returns {Promise<void>} ""
   */
  public async fetchBalance(): Promise<void> {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(
        `账户没有初始化，不同步余额`,
        "binance_usdt_future___fetchBalance"
      );
      return;
    }
    try {
      const queryStr = {
        recvWindow: 5000,
        timestamp: new Date().getTime(),
      };
      const signedStr = signatureObject(queryStr, this.apiSecret);
      const requestUrl = `${this.apiBaseUrl}/fapi/v2/balance?${signedStr}`;
      // logger.debug(`request account api`, requestUrl);
      const result = await axios.request({
        url: requestUrl,
        method: "get",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });
      const balanceList: IUsdtFutureBalanceItemBinance[] = _.get(
        result,
        "data",
        []
      );
      // logger.debug(JSON.stringify(balanceList));
      this.saveBalanceList(balanceList);
    } catch (e) {
      const error: any = e;
      const errMsg = _.get(e, "response.data.msg", undefined);
      if (errMsg) {
        logger.error(errMsg);
      } else {
        logger.error(error.toString());
      }
    }
  }

  public async fetchPositionRisk() {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(
        `The account is not synchronized and the balance is not initialized`,
        "binance_usdt_future___fetchPositions"
      );
      return;
    }
    try {
      const queryStr = {
        recvWindow: 5000,
        timestamp: new Date().getTime(),
      };
      const signedStr = signatureObject(queryStr, this.apiSecret);
      const requestUrl = `${this.apiBaseUrl}/fapi/v2/positionRisk?${signedStr}`;
      // logger.debug(`request account api`, requestUrl);
      const result = await axios.request({
        url: requestUrl,
        method: "get",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });
      // @ts-ignore
      const riskList: IUsdtFutureAccountPositionsRiskItemBinance[] = _.get(
        result,
        "data",
        {}
      );

      await this.savePositionRisk(riskList);
    } catch (e) {
      const error: any = e;
      const errMsg = _.get(e, "response.data.msg", undefined);
      if (errMsg) {
        logger.error(errMsg);
      } else {
        logger.error(error.toString());
      }
    }
  }
  private async savePositionRisk(
    riskList: IUsdtFutureAccountPositionsRiskItemBinance[]
  ) {
    const positionsInfo: {
      [key: string]: IUsdtFutureAccountPositionsRiskItem;
    } = {};
    for (const item of riskList) {
      const stdSymbol = this.getStdSymbol(item.symbol);
      if (stdSymbol === "") {
        logger.warn(item.symbol);
        continue;
      }
      const positionSide = item.positionSide;
      const positionData = {
        qty: _.get(item, "positionAmt", ""),
        availQty: _.get(item, "positionAmt", ""),
        avgCost: _.get(item, "entryPrice", ""),
        leverage: _.get(item, "leverage", ""),
        liquidationPrice: _.get(item, "liquidationPrice", ""),
        lastPrice: "0",
        markPrice: _.get(item, "markPrice", ""),
      };
      _.set(positionsInfo, `${stdSymbol}.fetchTimestamp`, new Date().getTime());
      _.set(positionsInfo, `${stdSymbol}.symbol`, stdSymbol);
      if (positionSide === "SHORT") {
        _.set(positionsInfo, `${stdSymbol}.SHORT`, positionData);
      }
      if (positionSide === "LONG") {
        _.set(positionsInfo, `${stdSymbol}.LONG`, positionData);
      }
      if (positionSide === "BOTH") {
        const positionAmt = Number(_.get(item, "positionAmt", "0"));
        if (positionAmt > 0) {
          _.set(positionsInfo, `${stdSymbol}.LONG`, positionData);
        }
        if (positionAmt < 0) {
          _.set(positionsInfo, `${stdSymbol}.SHORT`, positionData);
        }
        if (positionAmt === 0) {
          _.set(positionsInfo, `${stdSymbol}.LONG`, positionData);
          _.set(positionsInfo, `${stdSymbol}.SHORT`, positionData);
        }
      }
    }
    for (const key of Object.keys(positionsInfo)) {
      this.positionRisk.set(key, positionsInfo[key]);
    }
  }

  public getPositionRisk(): Map<string, IUsdtFutureAccountPositionsRiskItem> {
    return this.positionRisk;
  }
  private getStdSymbol(symbol: string): string {
    let stdSymbol = "";
    this.symbolsInfo.forEach((value) => {
      if (value.symbol === symbol) {
        stdSymbol = value.stdSymbol;
      }
    });
    return stdSymbol;
  }

  public async fetchOrdersBySymbol(symbol: string): Promise<any> {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(
        `The account has not been initialized, and the order list cannot be obtained`,
        "binance_usdt_future___fetchOrders"
      );
      return "";
    }
    try {
      const queryStr = {
        symbol: "ETHUSDT",
        recvWindow: 5000,
        timestamp: new Date().getTime(),
      };
      const signedStr = signatureObject(queryStr, this.apiSecret);
      const requestUrl = `${this.apiBaseUrl}/fapi/v1/allOrders?${signedStr}`;
      // logger.debug(`request account api`, requestUrl);
      const result = await axios.request({
        url: requestUrl,
        method: "get",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });
      const accountInfo: IUsdtFutureAccountPositionsRiskItemBinance[] = _.get(
        result,
        "data",
        {}
      );
      logger.debug(JSON.stringify(accountInfo));
    } catch (e) {
      const error: any = e;
      const errMsg = _.get(e, "response.data.msg", undefined);
      if (errMsg) {
        logger.error(errMsg);
      } else {
        logger.error(error.toString());
      }
    }
    return "";
  }

  private saveBalanceList(balanceList: IUsdtFutureBalanceItemBinance[]) {
    for (const item of balanceList) {
      _.set(item, "total", item.crossWalletBalance);
      _.set(item, "free", item.availableBalance);
      _.set(item, "timestamp", new Date().getTime());
      this.balance.set(item.asset, item);
    }
  }

  public getBalance(): Map<string, IUsdtFutureBalanceItemBinance> {
    const ret: Map<string, IUsdtFutureBalanceItemBinance> = new Map();

    this.balance.forEach((value, key) => {
      ret.set(key, {
        accountAlias: value.accountAlias, // "FzmYFzsRfWTisR",
        asset: value.asset, // value.asset,
        balance: value.balance, // "0.04377417",
        crossWalletBalance: value.crossWalletBalance, // "0.04377417",
        total: value.crossWalletBalance,
        free: value.availableBalance,
        crossUnPnl: value.crossUnPnl, // "0.00000000",
        availableBalance: value.availableBalance, // "0.56178156",
        maxWithdrawAmount: value.maxWithdrawAmount, // "0.04377417",
        marginAvailable: value.marginAvailable, // true,
        updateTime: value.updateTime, // 1675678261600,
        timestamp: value.timestamp,
      });
    });
    return ret;
  }

  /**
   * Initialize transaction pair information
   * @date 2023/5/12 - 13:33:34
   *
   * @public
   * @async
   * @returns {*} "void"
   */
  public async initMarkets(): Promise<void> {
    const url = `${this.apiBaseUrl}/fapi/v1/exchangeInfo`;
    try {
      logger.debug(`request symbol info url: ${url}`);
      const result = await axios.request({
        httpsAgent: httpsKeepAliveAgent,
        url,
      });

      const symbols: IUsdtFutureSymbolItemBinance[] = _.get(
        result,
        "data.symbols",
        []
      );
      this.setExchangeSymbolInfo(symbols);
    } catch (e) {
      const err: any = e;
      logger.debug(err.toString());
      throw new Error(`request ${url} Error:${err.toString()}`);
    }
  }

  private setExchangeSymbolInfo(symbols: IUsdtFutureSymbolItemBinance[]) {
    for (const item of symbols) {
      if (
        !["CLOSE", "PENDING_TRADING"].includes(item.status) &&
        item.contractType === "PERPETUAL"
      ) {
        const stdSymbol = `${item.baseAsset}-${item.quoteAsset}-SWAP:USDT`;
        // logger.debug(`set swap info`, stdSymbol);
        _.set(item, "stdSymbol", stdSymbol);
        this.symbolsInfo.set(item.stdSymbol, item);
      }
    }
    logger.debug(`symbol list count: 【${this.symbolsInfo.size}】`);
  }

  public fetchMarkets(): Map<string, IUsdtFutureSymbolItem> {
    const ret: Map<string, IUsdtFutureSymbolItem> = new Map();
    this.symbolsInfo.forEach((value, key) => {
      ret.set(key, {
        symbol: value.symbol,
        status: value.status,
        stdSymbol: value.stdSymbol,
        symbolType: value.contractType,
        baseAsset: value.baseAsset,
        quoteAsset: value.quoteAsset,
        orderTypes: value.orderTypes,
        baseAssetPrecision: value.baseAssetPrecision,
        quoteAssetPrecision: value.quantityPrecision,
      });
    });
    return ret;
  }

  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber,
    side: ISide
  ): Promise<any> {
    throw new Error(`not yet implemented`);
    // logger.debug(orderId, stdSymbol, amount, side);

    // const orderData = {
    //   symbol: "ETHUSDT",
    //   positionSide: "BOTH",
    //   side: "SELL",
    //   quantity: 0.6,
    //   recvWindow: 5000,
    //   type: IOrderTypeBinance.Market,
    //   newClientOrderId: orderId,
    //   timestamp: new Date().getTime(),
    // };
    // const postStr = signatureObject(orderData, this.apiSecret);
    // const orderUrl = `${this.apiBaseUrl}/fapi/v1/order`;
    // const result = await axios.request({
    //   url: orderUrl,
    //   method: "POST",
    //   headers: {
    //     "X-MBX-APIKEY": this.apiKey,
    //   },
    //   data: postStr,
    //   httpsAgent: httpsKeepAliveAgent,
    // });
    // logger.info(result);
    // process.exit();
  }
}

export { BinanceUsdtFuture };
