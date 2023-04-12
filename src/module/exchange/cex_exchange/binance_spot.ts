/* eslint-disable arrow-parens */
import axios from "axios";
import {
  ISpotSymbolItemBinance,
  ISpotBalanceItemBinance,
  IOrderTypeBinance,
  ISpotOrderResponseBinance,
} from "../../../interface/cex_binance"; // 引入binance 接口返回和 enum的定义
import { httpsKeepAliveAgent } from "../../../sys_lib/http_agent";
import { logger } from "../../../sys_lib/logger";
import * as _ from "lodash";
import { signatureObject } from "../utils";
import {
  ISide,
  ISpotBalanceItem,
  ISpotOrderResult,
} from "../../../interface/std_difi";
import BigNumber from "bignumber.js";
import { IStdExchangeSpot } from "../../../interface/std_exchange";
import { binanceConfig } from "./binance_config";
import { BinanceSpotRequest } from "./binance_spot_request";

class BinanceSpot implements IStdExchangeSpot {
  private apiKey: string;
  private apiSecret: string;
  private balance: Map<string, ISpotBalanceItemBinance> = new Map();
  private apiBaseUrl = "https://testnet.binance.vision";
  protected spotSymbolsInfo: Map<string, ISpotSymbolItemBinance> = new Map();

  public constructor(accountInfo: { apiKey: string; apiSecret: string }) {
    this.apiKey = accountInfo.apiKey;
    this.apiSecret = accountInfo.apiSecret;
    this.apiBaseUrl = binanceConfig.getSpotBaseApi();
  }

  public async fetchBalance(): Promise<void> {
    try {
      const queryStr = {
        recvWindow: 5000,
        timestamp: new Date().getTime(),
      };
      const signedStr = signatureObject(queryStr, this.apiSecret);
      const requestUrl = `${this.apiBaseUrl}/api/v3/account?${signedStr}`;
      // logger.debug(`request account api`, requestUrl);
      const result = await axios.request({
        url: requestUrl,
        method: "get",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
      });
      const balanceList: ISpotBalanceItemBinance[] = _.get(
        result,
        "data.balances",
        []
      );
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

  private saveBalanceList(balanceList: ISpotBalanceItemBinance[]) {
    for (const item of balanceList) {
      this.balance.set(item.asset, item);
    }
  }

  public async initMarkets() {
    const url = `${this.apiBaseUrl}/api/v3/exchangeInfo`;
    try {
      logger.debug(`request symbol info url: ${url}`);
      const result = await axios.request({
        httpsAgent: httpsKeepAliveAgent,
        url,
      });

      const symbols: ISpotSymbolItemBinance[] = _.get(
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

  public async spotTradeCheck(stdSymbol: string, value: number): Promise<boolean> {
    if (stdSymbol === "T/USDT") {
      return true;
    }
    const item = this.spotSymbolsInfo.get(stdSymbol);
    if (!item) {
      logger.warn(`No trading pair information found ${stdSymbol}`);
      return false;
    }
    // logger.debug(item.filters);
    const filterSet = _.find(item.filters, { filterType: "NOTIONAL" });
    if (!filterSet || !_.get(filterSet, "minNotional", undefined)) {
      logger.warn("filter not found", item.filters);
      return true;
    }
    const minNotional = Number(_.get(filterSet, "minNotional"));
    if (value > minNotional) {
      return true;
    }
    logger.warn(`The transaction volume does not meet the minimum order limit`, value, minNotional);
    return false;
  }

  private setExchangeSymbolInfo(symbols: ISpotSymbolItemBinance[]) {
    for (const item of symbols) {
      if (item.status === "TRADING") {
        const stdSymbol = `${item.baseAsset}/${item.quoteAsset}`;
        _.set(item, "stdSymbol", stdSymbol);
        this.spotSymbolsInfo.set(item.stdSymbol, item);
      }
    }
    logger.debug(`symbol list count: 【${this.spotSymbolsInfo.size}】`);
  }

  public fetchMarkets(): Map<string, ISpotSymbolItemBinance> {
    return this.spotSymbolsInfo;
  }

  /**
   * Description 创建一个市价单
   * @date 1/17/2023 - 9:02:54 PM
   *
   * @public
   * @async
   * @param {string} orderId "001"
   * @param {string} stdSymbol "ETH/USDT"
   * @param {BigNumber} amount "new Bignumber(0.005)"
   * @param {ISide} side "Iside"
   * @returns {Promise<ISpotOrderResult>} ISpotOrderResult
   */
  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber,
    side: ISide
  ): Promise<ISpotOrderResult> {
    const symbol = this.getSymbolByStdSymbol(stdSymbol);
    if (!symbol) {
      logger.error(`无法找到交易的Symbol信息......FindOption`, stdSymbol);
      throw new Error(`无法找到对应的交易对信息:${stdSymbol}`);
    }
    logger.debug(`准备创建订单........`);
    const orderData = {
      symbol,
      side,
      type: IOrderTypeBinance.Market, //  市价单
      // timeInForce: ITimeInForceBinance.FOK, // 立即成交或者拒绝
      recvWindow: 5000,
      quantity: Number(this.formatBigNumberPrecision(stdSymbol, amount)),
      newClientOrderId: orderId,
      timestamp: new Date().getTime(),
    };
    logger.debug(`用户 【${this.apiKey}】下单:`);
    console.table(orderData);
    const postStr = signatureObject(orderData, this.apiSecret);
    logger.debug("post Str", postStr);
    let result;
    try {
      result = await axios.request({
        url: `${this.apiBaseUrl}/api/v3/order`,
        method: "POST",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
        data: postStr,
      });
      _.set(result, "data.stdSymbol", stdSymbol); // 结果中设置Stdsymbol
      logger.debug("下单完成", "下单返回的信息:");
      console.log("_______________________________");
      const execResult = this.formatMarketResponse(_.get(result, "data", {}));
      console.table(_.get(result, "data.fills", {}));
      _.set(execResult, "feeView", JSON.stringify(execResult.fee));
      console.table(execResult);
      console.log("_______________________________");
      return execResult;
    } catch (e) {
      const errMsg = _.get(e, "response.data.msg", undefined);
      logger.error(`创建订单到Binance发生了错误`, errMsg);
      if (errMsg) {
        throw new Error(errMsg);
      }
      throw e;
    }
  }

  /**
   * Description 返回定义好的订单格式
   * @date 1/17/2023 - 9:03:56 PM
   *
   * @private
   * @param {ISpotOrderResponseBinance} retData ""
   * @returns {ISpotOrderResult} ""
   */
  private formatMarketResponse(
    retData: ISpotOrderResponseBinance
  ): ISpotOrderResult {
    const stdSymbol = _.get(retData, "stdSymbol", "");
    const result: ISpotOrderResult = {
      side: (() => {
        return _.get(retData, "side", "");
      })(),
      type: _.get(retData, "type", ""),
      timeInForce: _.get(retData, "timeInForce", ""),
      fee: this.getOrderFee(retData),
      info: JSON.stringify(retData),
      symbol: retData.symbol,
      stdSymbol: _.get(retData, "stdSymbol", ""),
      amount: (() => {
        // 订单原始设置的量
        const origQty = _.get(retData, "origQty", undefined);
        if (!origQty) {
          return 0;
        }
        return Number(
          this.formatBigNumberPrecision(stdSymbol, new BigNumber(origQty))
        );
      })(),
      filled: (() => {
        const executedQty = new BigNumber(_.get(retData, "executedQty", "0"));
        return Number(this.formatBigNumberPrecision(stdSymbol, executedQty));
      })(),
      remaining: (() => {
        // 剩余未执行的量
        const origQty = new BigNumber(_.get(retData, "origQty", "0"));
        const executedQty = new BigNumber(_.get(retData, "executedQty", "0"));
        const remaining = origQty.minus(executedQty);
        return Number(this.formatBigNumberPrecision(stdSymbol, remaining));
      })(),
      clientOrderId: retData.clientOrderId,
      timestamp: _.get(retData, "workingTime", 0), // 添加到orderbook时的时间戳
      lastTradeTimestamp: _.get(retData, "transactTime", 0),
      average: (() => {
        // 成交均价
        const cummulativeQuoteQty = new BigNumber(
          _.get(retData, "cummulativeQuoteQty", "0")
        ); // 累计成交金额
        const executedQty = new BigNumber(_.get(retData, "executedQty", "0")); // 交易的订单数量
        return Number(
          cummulativeQuoteQty.div(executedQty).toFixed(8).toString()
        );
      })(),
      averagePrice: (() => {
        const cummulativeQuoteQty = new BigNumber(
          _.get(retData, "cummulativeQuoteQty", "0")
        );
        const executedQty = new BigNumber(_.get(retData, "executedQty", "0"));
        return cummulativeQuoteQty.div(executedQty).toFixed(8).toString();
      })(),
      status: retData.status,
    };
    return result;
  }

  private getOrderFee(retData: any): { [key: string]: string } {
    const fee = {};
    const fills: { commission: string; commissionAsset: string }[] = _.get(
      retData,
      "fills",
      []
    );
    fills.map((it) => {
      const curCommission: any | undefined = _.get(
        fee,
        it.commissionAsset,
        undefined
      );
      if (!curCommission) {
        _.set(fee, it.commissionAsset, new BigNumber(it.commission).toString());
        return null;
      }
      const BnNumber = new BigNumber(curCommission);
      const feeVal = BnNumber.plus(new BigNumber(it.commission));
      _.set(fee, it.commissionAsset, feeVal.toString());
      return null;
    });
    return fee;
  }

  private getSymbolByStdSymbol(stdSymbol: string) {
    const entries: any[] = [];
    this.spotSymbolsInfo.forEach((value) => {
      entries.push(value);
    });

    // console.log(JSON.stringify(entries));
    const info = this.spotSymbolsInfo.get(stdSymbol);
    if (!info) {
      return null;
    }
    return info.symbol;
  }

  private getSymbolInfoByStdSymbol(stdSymbol: string) {
    const info = this.spotSymbolsInfo.get(stdSymbol);
    if (!info) {
      return null;
    }
    return info;
  }

  /**
   * Description 返回现货的余额的一个Map
   * @date 2/2/2023 - 4:49:20 PM
   *
   * @public
   * @returns {*} Map<string, ISpotBalanceItem>
   */
  public getBalance(): Map<string, ISpotBalanceItem> {
    const ret: Map<string, ISpotBalanceItem> = new Map();
    this.balance.forEach((value, key) => {
      ret.set(key, {
        asset: value.asset,
        free: value.free,
        locked: value.locked,
      });
    });
    return ret;
  }

  /**
   * Description 处理下单时的单位问题
   * @date 2023/2/13 - 15:29:45
   *
   * @private
   * @param {string} stdSymbol "ETH/USDT"
   * @param {number} valNaumber 100.000
   * @returns {*} "value string"
   */
  // @ts-ignore
  private formatPrecision(stdSymbol: string, valNaumber: number): string {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      throw new Error("没有找到symbolInfo，无法格式化数值");
    }
    const assetPrecision = _.get(symbolInfo, "quoteAssetPrecision", undefined);
    if (!assetPrecision || !_.isFinite(assetPrecision)) {
      throw new Error(`没有找到正确的下单单位`);
    }
    const value = new BigNumber(valNaumber);
    const val = value.toFixed(parseInt(assetPrecision.toString())).toString();
    return val;
  }

  /**
   * Description 处理下单时的单位问题
   * @date 2023/2/13 - 15:25:47
   *
   * @private
   * @param {string} stdSymbol "ETH/USDT"
   * @param {*} value "number"
   * @returns {string} "Number String"
   */
  private formatBigNumberPrecision(stdSymbol: string, value: any): string {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      throw new Error("没有找到symbolInfo，无法格式化数值");
    }
    const assetPrecision = _.get(symbolInfo, "quoteAssetPrecision", undefined);
    if (!assetPrecision || !_.isFinite(assetPrecision)) {
      throw new Error(`没有找到正确的下单单位`);
    }

    const val = value.toFixed(parseInt(assetPrecision.toString())).toString();
    logger.warn(
      "amount cex precision 已经转换",
      value.toString(),
      val.toString()
    );
    return val;
  }

  public async capitalAll() {
    // /sapi/v1/capital/config/getall
    const capitalAllUrl = `https://api.binance.com/sapi/v1/capital/config/getall`;
    // const capitalAllUrl = "https://api.binance.com/api/v3/pinssg";
    const queryData = undefined;
    const request = new BinanceSpotRequest();
    const ret = await request.get(
      capitalAllUrl,
      queryData,
      "NzhXa9logqSx3Pnaejsa9siBtAnY5wPAmpyA7WN797BCGaaPxL8uWL178oWmYOLq", // this.apiKey,
      "c8qoWHR1TwkwfoiV4lMAoa1b1AyW454jbdGzezeBKDpIG4TjIaeTtz6QtjbvGeFs" // this.apiSecret
    );
    return _.get(ret, "data", undefined);
  }

  public async withdrawApply() {
    const withdrawApplyUrl = `https://api.binance.com/sapi/v1/capital/withdraw/apply`;
    const orderData = {
      coin: "SHIB",
      withdrawOrderId: "FRISTBSC",
      network: "BSC",
      address: "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A",
      amount: 20000,
      walletType: 0,
      recvWindow: 5000,
      timestamp: new Date().getTime(),
    };
    const request = new BinanceSpotRequest();
    try {
      await request.post(
        withdrawApplyUrl,
        orderData,
        this.apiKey,
        this.apiSecret
      );
    } catch (e) {
      logger.error(e);
    }
  }
}

export { BinanceSpot };
