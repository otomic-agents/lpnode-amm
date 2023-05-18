/* eslint-disable arrow-parens */
import axios from "axios";
import {
  ISpotSymbolItemBinance,
  ISpotBalanceItemBinance,
  IOrderTypeBinance,
  ISpotOrderResponseBinance,
} from "../../../interface/cex_binance";
import { httpsKeepAliveAgent } from "../../../sys_lib/http_agent";
import { logger } from "../../../sys_lib/logger";
import * as _ from "lodash";
import { formatStepSize, signatureObject } from "../utils";
import {
  ISide,
  ISpotBalanceItem,
  ISpotOrderResult,
} from "../../../interface/std_difi";
import BigNumber from "bignumber.js";
import { IStdExchangeSpot } from "../../../interface/std_exchange";
import { binanceConfig } from "./binance_config";
import { BinanceSpotRequest } from "./binance_spot_request";
import { SystemMath } from "../../../utils/system_math";
import { ConsoleDirDepth5 } from "../../../utils/console";

class BinanceSpot implements IStdExchangeSpot {
  private apiKey: string;
  private apiSecret: string;
  private balance: Map<string, ISpotBalanceItemBinance> = new Map();
  private apiBaseUrl = "";
  protected spotSymbolsInfo: Map<string, ISpotSymbolItemBinance> = new Map();

  public constructor(accountInfo: { apiKey: string; apiSecret: string }) {
    this.apiKey = accountInfo.apiKey;
    this.apiSecret = accountInfo.apiSecret;
    this.apiBaseUrl = binanceConfig.getSpotBaseApi();
  }

  public async fetchBalance(): Promise<void> {
    if (this.apiKey === "" || this.apiSecret === "") {
      logger.warn(`apiKey not found`);
      return;
    }
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
      throw new Error(`${url} request error,Error:${err.toString()}`);
    }
  }

  public async spotTradeCheck(
    stdSymbol: string,
    value: number,
    amount: number
  ): Promise<boolean> {
    if (stdSymbol === "T/USDT") {
      return true;
    }
    const item = this.spotSymbolsInfo.get(stdSymbol);
    if (!item) {
      logger.warn(`No trading pair information found ${stdSymbol}`);
      return false;
    }
    try {
      logger.info(`filters_NOTIONAL`);
      this.filters_NOTIONAL(item, value);
      logger.info(`filters_LOT_SIZE`);
      this.filters_LOT_SIZE(item, amount);
      return true;
    } catch (e) {
      logger.error(e);
      return false;
    }
  }

  public async spotGetTradeMinMax(
    stdSymbol: string,
    price: number
  ): Promise<[number, number]> {
    if (stdSymbol === "T/USDT") {
      return [0, 0];
    }
    const item = this.spotSymbolsInfo.get(stdSymbol);
    if (!item) {
      logger.warn(`No trading pair information found ${stdSymbol}`);
      return [0, 0];
    }
    const filterSet = _.find(item.filters, { filterType: "NOTIONAL" });
    if (!filterSet || !_.get(filterSet, "minNotional", undefined)) {
      logger.warn("filter not found", item.filters);
      return [0, 0];
    }
    const minNotional = _.get(filterSet, "minNotional");
    const maxNotional = _.get(filterSet, "maxNotional");
    return [
      SystemMath.execNumber(`${minNotional}/${price}`),
      SystemMath.execNumber(`${maxNotional}/${price}`),
    ];
  }

  public async spotGetTradeMinMaxValue(
    stdSymbol: string
  ): Promise<[number, number]> {
    if (stdSymbol === "T/USDT") {
      return [0, 0];
    }
    const item = this.spotSymbolsInfo.get(stdSymbol);
    if (!item) {
      logger.warn(`No trading pair information found ${stdSymbol}`);
      return [0, 0];
    }
    const filterSet = _.find(item.filters, { filterType: "NOTIONAL" });
    if (!filterSet || !_.get(filterSet, "minNotional", undefined)) {
      logger.warn("filter not found", item.filters);
      return [0, 0];
    }
    const minNotional = _.get(filterSet, "minNotional");
    const maxNotional = _.get(filterSet, "maxNotional");
    logger.info(stdSymbol, filterSet);
    return [
      SystemMath.execNumber(`${minNotional} * 1`),
      SystemMath.execNumber(`${maxNotional} * 1`),
    ];
  }

  public async spotGetTradeMinNotional(stdSymbol: string): Promise<number> {
    if (stdSymbol === "T/USDT") {
      return 0;
    }
    if (stdSymbol === "USDT/USDT" || stdSymbol === "USDC/USDT") {
      return 0;
    }
    const item = this.spotSymbolsInfo.get(stdSymbol);
    if (!item) {
      logger.warn(`No trading pair information found ${stdSymbol}`);
      return 0;
    }

    const filterSet = _.find(item.filters, { filterType: "NOTIONAL" });
    if (!filterSet || !_.get(filterSet, "minNotional", undefined)) {
      logger.warn("filter not found", item.filters);
      return 0;
    }
    const minNotional = _.get(filterSet, "minNotional");
    return Number(minNotional);
  }

  private filters_NOTIONAL(item: ISpotSymbolItemBinance, value: number) {
    const filterSet = _.find(item.filters, { filterType: "NOTIONAL" });
    if (!filterSet || !_.get(filterSet, "minNotional", undefined)) {
      logger.warn("filter not found", item.filters);
      return;
    }

    const minNotional = Number(_.get(filterSet, "minNotional"));
    if (value > minNotional) {
      return;
    }
    logger.warn(
      `The transaction volume does not meet the minimum order limit`,
      value,
      minNotional
    );
    throw new Error(
      `The transaction volume does not meet the minimum order limit input:${value} ${minNotional}`
    );
  }

  private filters_LOT_SIZE(item: ISpotSymbolItemBinance, value: number) {
    const filterSet = _.find(item.filters, { filterType: "LOT_SIZE" });
    if (!filterSet || !_.get(filterSet, "minQty", undefined)) {
      logger.warn("filter not found", item.filters);
      return;
    }

    const min = Number(_.get(filterSet, "minQty"));
    const max = Number(_.get(filterSet, "maxQty"));
    if (value >= min && value <= max) {
      return;
    }
    logger.warn(`The transaction amount error LOT_SIZE`, value, min, max);
    throw new Error(
      `The transaction amount error LOT_SIZE value [${value}] , filter [${min}] [${max}]`
    );
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

  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber | undefined,
    quoteOrderQty: BigNumber | undefined,
    side: ISide,
    simulation = false
  ): Promise<ISpotOrderResult> {
    console.dir(this.spotSymbolsInfo.get(stdSymbol));
    const symbol = this.getSymbolByStdSymbol(stdSymbol);

    if (!symbol) {
      logger.error(`无法找到交易的Symbol信息......FindOption`, stdSymbol);
      throw new Error(`无法找到对应的交易对信息:${stdSymbol}`);
    }
    const tradeInfo = this.spotSymbolsInfo.get(stdSymbol);
    if (!tradeInfo) {
      logger.error(`无法找到交易信息......FindOption`, stdSymbol);
      throw new Error(`无法找到交易信息:${stdSymbol}`);
    }
    logger.debug(`准备创建订单........`);
    const orderData = {
      symbol,
      side,
      type: IOrderTypeBinance.Market,
      // timeInForce: ITimeInForceBinance.FOK,
      recvWindow: 5000,
      newClientOrderId: orderId,
      timestamp: new Date().getTime(),
    };
    this.setAmountOrQty(
      stdSymbol,
      amount,
      quoteOrderQty,
      orderData,
      tradeInfo.filters
    );
    let lostAmount = "";
    const origAmount = amount?.toString();
    logger.debug(`User 【${this.apiKey}】create order:`);
    console.dir(orderData, { depth: 5 });
    lostAmount = _.get(orderData, "lostAmount", "");
    delete orderData["lostAmount"];

    const postStr = signatureObject(orderData, this.apiSecret);
    logger.debug("post Str", postStr);
    let result;
    let orderUrl = `${this.apiBaseUrl}/api/v3/order`;
    if (simulation === true) {
      orderUrl = `${this.apiBaseUrl}/api/v3/order/test`;
      logger.warn("simulation order ");
    }
    try {
      result = await axios.request({
        url: orderUrl,
        method: "POST",
        headers: {
          "X-MBX-APIKEY": this.apiKey,
        },
        data: postStr,
        httpsAgent: httpsKeepAliveAgent,
      });
      _.set(result, "data.stdSymbol", stdSymbol);
      _.set(result, "data.inputInfo", {
        amount: _.get(orderData, "quantity", ""),
        lostAmount,
        origAmount,
      });

      logger.debug("order complete", "result:");
      console.log("_______________________________");
      const execResult = this.formatMarketResponse(_.get(result, "data", {}));
      console.dir(_.get(result, "data.fills", {}), ConsoleDirDepth5);
      console.dir(execResult, ConsoleDirDepth5);
      console.log("_______________________________");
      return execResult;
    } catch (e) {
      const errMsg = _.get(e, "response.data.msg", undefined);
      logger.error(`create Binance order err:`, errMsg);
      if (errMsg) {
        throw new Error(errMsg);
      }
      throw e;
    }
  }

  private setAmountOrQty(
    stdSymbol: string,
    amount: BigNumber | undefined,
    qty: BigNumber | undefined,
    struct: any,
    filters: any[]
  ) {
    if (amount !== undefined) {
      const lotSizeFilter = _.find(filters, { filterType: "LOT_SIZE" });
      if (!lotSizeFilter) {
        throw new Error("filter not fount :LOT_SIZE");
      }
      const stepSize = lotSizeFilter["stepSize"];
      const [tradeAmount, lostAmount] = formatStepSize(
        amount.toString(),
        stepSize
      );
      _.set(
        struct,
        "quantity",
        Number(
          this.formatBigNumberPrecision(stdSymbol, new BigNumber(tradeAmount))
        )
      );
      _.set(struct, "lostAmount", new BigNumber(lostAmount).toString());
    }
    if (qty !== undefined) {
      throw new Error(`test error`);
      // _.set(
      //   struct,
      //   "quoteOrderQty",
      //   Number(this.formatBigNumberPrecision(stdSymbol, qty))
      // );
    }
  }

  /**
   * format order
   * @date 1/17/2023 - 9:03:56 PM
   *
   * @private
   * @param {ISpotOrderResponseBinance} retData ""
   * @returns {ISpotOrderResult} ""
   */
  private formatMarketResponse(
    retData: ISpotOrderResponseBinance
  ): ISpotOrderResult {
    // console.dir(retData, { depth: 5 });
    const stdSymbol = _.get(retData, "stdSymbol", "");
    const result: ISpotOrderResult = {
      side: (() => {
        return _.get(retData, "side", "");
      })(),
      orderId: retData.orderId,
      lostAmount: _.get(retData, "inputInfo.lostAmount", ""),
      origAmount: _.get(retData, "inputInfo.origAmount", ""),
      type: _.get(retData, "type", ""),
      timeInForce: _.get(retData, "timeInForce", ""),
      fee: this.getOrderFee(retData),
      info: JSON.stringify(retData),
      symbol: retData.symbol,
      stdSymbol: _.get(retData, "stdSymbol", ""),
      amount: (() => {
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
        const origQty = new BigNumber(_.get(retData, "origQty", "0"));
        const executedQty = new BigNumber(_.get(retData, "executedQty", "0"));
        const remaining = origQty.minus(executedQty);
        return Number(this.formatBigNumberPrecision(stdSymbol, remaining));
      })(),
      clientOrderId: retData.clientOrderId,
      timestamp: _.get(retData, "workingTime", 0),
      lastTradeTimestamp: _.get(retData, "transactTime", 0),
      average: (() => {
        const cummulativeQuoteQty = new BigNumber(
          _.get(retData, "cummulativeQuoteQty", "0")
        );
        const executedQty = new BigNumber(_.get(retData, "executedQty", "0"));
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
   * Description get spot balance Map
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
   * order  precision
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
      throw new Error("symbolInfo not found");
    }
    const assetPrecision = _.get(symbolInfo, "quoteAssetPrecision", undefined);
    if (!assetPrecision || !_.isFinite(assetPrecision)) {
      throw new Error(`quoteAssetPrecision not found`);
    }
    const value = new BigNumber(valNaumber);
    const val = value.toFixed(parseInt(assetPrecision.toString())).toString();
    return val;
  }

  /**
   * order  precision
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
      throw new Error("symbolInfo not found");
    }
    const assetPrecision = _.get(symbolInfo, "quoteAssetPrecision", undefined);
    if (!assetPrecision || !_.isFinite(assetPrecision)) {
      throw new Error(`quoteAssetPrecision not found`);
    }

    const val = value.toFixed(parseInt(assetPrecision.toString())).toString();
    logger.warn(
      "amount cex precision converted",
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
