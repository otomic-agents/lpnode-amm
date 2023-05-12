import axios from "axios";
import { IStdExchangeCoinFuture } from "../../../interface/std_exchange";
import { logger } from "../../../sys_lib/logger";
import { signatureObject } from "../utils";
import * as _ from "lodash";
import {
  ICoinFutureBalanceItemBinance,
  ICoinFutureSymbolItemBinance,
} from "../../../interface/cex_binance";
import {
  ICoinFutureBalanceItem,
  ICoinFutureSymbolItem,
} from "../../../interface/std_difi";
import { httpsKeepAliveAgent } from "../../../sys_lib/http_agent";
import { binanceConfig } from "./binance_config";

class BinanceCoinFuture implements IStdExchangeCoinFuture {
  private apiKey: string;
  private apiSecret: string;
  private apiBaseUrl = "";
  private balance: Map<string, ICoinFutureBalanceItemBinance> = new Map();
  private symbolsInfo: Map<string, ICoinFutureSymbolItemBinance> = new Map();

  constructor(accountInfo: { apiKey: string; apiSecret: string }) {
    this.apiKey = accountInfo.apiKey;
    this.apiSecret = accountInfo.apiSecret;
    this.apiBaseUrl = binanceConfig.getCoinFutureBaseApi();
  }

  public async initMarkets() {
    const url = `${this.apiBaseUrl}/dapi/v1/exchangeInfo`;
    try {
      logger.debug(`request symbol info url: ${url}`);
      const result = await axios.request({
        httpsAgent: httpsKeepAliveAgent,
        url,
      });

      const symbols: ICoinFutureSymbolItemBinance[] = _.get(
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

  private setExchangeSymbolInfo(symbols: ICoinFutureSymbolItemBinance[]) {
    for (const item of symbols) {
      if (
        item.contractStatus === "TRADING" &&
        item.contractType === "PERPETUAL"
      ) {
        // 先只放永续合约
        const stdSymbol = `${item.baseAsset}/${item.quoteAsset}`;
        _.set(item, "stdSymbol", stdSymbol);
        this.symbolsInfo.set(item.stdSymbol, item);
      }
    }
    logger.debug(`symbol list count: 【${this.symbolsInfo.size}】`);
  }

  public fetchMarkets(): Map<string, ICoinFutureSymbolItem> {
    const ret: Map<string, ICoinFutureSymbolItem> = new Map();
    this.symbolsInfo.forEach((value, key) => {
      ret.set(key, {
        symbol: value.symbol,
        status: value.contractStatus,
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

  public async fetchBalance(): Promise<void> {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(
        `账户没有同步，不初始化余额`,
        "binance_coin_future___fetchBalance"
      );
      return;
    }
    // /dapi/v1/balance
    try {
      const queryStr = {
        recvWindow: 5000,
        timestamp: new Date().getTime(),
      };
      const signedStr = signatureObject(queryStr, this.apiSecret);
      const requestUrl = `${this.apiBaseUrl}/dapi/v1/balance?${signedStr}`;
      // logger.debug(`request account api`, requestUrl);
      const result = await axios.request({
        url: requestUrl,
        method: "get",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });
      const balanceList: any = _.get(result, "data", {});
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

  private saveBalanceList(balanceList: ICoinFutureBalanceItemBinance[]) {
    for (const item of balanceList) {
      this.balance.set(item.asset, item);
    }
  }

  public getBalance(): Map<string, ICoinFutureBalanceItem> {
    const ret: Map<string, ICoinFutureBalanceItem> = new Map();
    this.balance.forEach((value, key) => {
      ret.set(key, {
        accountAlias: value.accountAlias, // "SgsR"; // 账户唯一识别码
        asset: value.asset, // "BTC"; // 资产
        balance: value.balance, // "0.00250000"; // 账户余额
        withdrawAvailable: value.withdrawAvailable, // "0.00250000"; // 最大可提款金额,同`GET /dapi/account`中"maxWithdrawAmount"
        crossWalletBalance: value.crossWalletBalance, // "0.00241969"; // 全仓账户余额
        crossUnPnl: value.crossUnPnl, // "0.00000000"; // 全仓持仓未实现盈亏
        availableBalance: value.availableBalance, // "0.00241969"; // 可用下单余额
      });
    });
    return ret;
  }
}

export { BinanceCoinFuture };
