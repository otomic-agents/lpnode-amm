import axios from "axios";
import {
  IUsdtFutureSymbolItemBinance,
  IUsdtFutureBalanceItemBinance,
  IOrderTypeBinance, IUsdtFutureAccountPositionsItemBinance,
} from "../../../interface/cex_binance";
import { logger } from "../../../sys_lib/logger";
import { signatureObject } from "../utils";
import * as _ from "lodash";
import { IStdExchangeUsdtFuture } from "../../../interface/std_exchange";
import BigNumber from "bignumber.js";
import { ISide, IUsdtFutureSymbolItem } from "../../../interface/std_difi";
import { httpsKeepAliveAgent } from "../../../sys_lib/http_agent";
import { binanceConfig } from "./binance_config";

class BinanceUsdtFuture implements IStdExchangeUsdtFuture {
  private apiKey: string;
  private apiSecret: string;
  private apiBaseUrl = "";
  protected symbolsInfo: Map<string, IUsdtFutureSymbolItemBinance> = new Map();
  protected balance: Map<string, IUsdtFutureBalanceItemBinance> = new Map();

  constructor(accountInfo: { apiKey: string; apiSecret: string }) {
    this.apiKey = accountInfo.apiKey;
    this.apiSecret = accountInfo.apiSecret;
    this.apiBaseUrl = binanceConfig.getUsdtFutureBaseApi();
  }

  public async fetchBalance(): Promise<void> {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(`账户没有初始化，不同步余额`, "binance_usdt_future___fetchBalance");
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

  public async fetchPositions() {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(`账户没有初始化，不同步余额`, "binance_usdt_future___fetchPositions");
      return;
    }
    try {
      const queryStr = {
        recvWindow: 5000,
        timestamp: new Date().getTime(),
      };
      const signedStr = signatureObject(queryStr, this.apiSecret);
      const requestUrl = `${this.apiBaseUrl}/fapi/v2/account?${signedStr}`;
      // logger.debug(`request account api`, requestUrl);
      const result = await axios.request({
        url: requestUrl,
        method: "get",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });
      // @ts-ignore
      const accountInfo: IUsdtFutureAccountPositionsItemBinance[] = _.get(
        result,
        "data",
        {}
      );
      // logger.debug(JSON.stringify(accountInfo));
      // this.saveBalanceList(balanceList);
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

  public async fetchOrdersBySymbol(symbol: string): Promise<any> {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(`账户没有初始化，无法获取订单列表`, "binance_usdt_future___fetchOrders");
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
      const accountInfo: IUsdtFutureAccountPositionsItemBinance[] = _.get(
        result,
        "data",
        {}
      );
      logger.debug(JSON.stringify(accountInfo));
      // this.saveBalanceList(balanceList);
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
      logger.debug(item);
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
        crossUnPnl: value.crossUnPnl, // "0.00000000",
        availableBalance: value.availableBalance, // "0.56178156",
        maxWithdrawAmount: value.maxWithdrawAmount, // "0.04377417",
        marginAvailable: value.marginAvailable, // true,
        updateTime: value.updateTime, // 1675678261600,
      });
    });
    return ret;
  }

  public async initMarkets() {
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
      throw new Error(`请求${url}发生了错误，Error:${err.toString()}`);
    }
  }

  private setExchangeSymbolInfo(symbols: IUsdtFutureSymbolItemBinance[]) {
    for (const item of symbols) {
      if (item.status === "TRADING" && item.contractType === "PERPETUAL") {
        // 先只放永续合约
        const stdSymbol = `${item.baseAsset}/${item.quoteAsset}`;
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
    logger.debug(orderId, stdSymbol, amount, side);

    const orderData = {
      symbol: "ETHUSDT",
      positionSide: "BOTH",
      side: "SELL",
      quantity: 0.6,
      recvWindow: 5000,
      type: IOrderTypeBinance.Market,
      newClientOrderId: orderId,
      timestamp: new Date().getTime(),
    };
    const postStr = signatureObject(orderData, this.apiSecret);
    const orderUrl = `${this.apiBaseUrl}/fapi/v1/order`;
    const result = await axios.request({
      url: orderUrl,
      method: "POST",
      headers: {
        "X-MBX-APIKEY": this.apiKey,
      },
      data: postStr,
      httpsAgent: httpsKeepAliveAgent,
    });
    logger.info(result);
    process.exit();
  }
}

export { BinanceUsdtFuture };
