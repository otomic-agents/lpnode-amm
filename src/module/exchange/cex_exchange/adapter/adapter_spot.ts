import { IStdExchangeSpot } from "../../../../interface/std_exchange";
import {
  IOrderExecModel,
  ISide,
  ISpotBalanceItem,
  ISpotOrderResult,
} from "../../../../interface/std_difi";
import BigNumber from "bignumber.js";
import axios from "axios";
import * as _ from "lodash";
import { logger } from "../../../../sys_lib/logger";
import { SystemMath } from "../../../../utils/system_math";
import { ISpotSymbolItemAdapter } from "../../../../interface/cex_adapter";
import { formatStepSize } from "../../utils";
import { adapterConfig } from "./adapter_config";
class AdapterSpot implements IStdExchangeSpot {
  public exchangeName = "binance";
  private accountId = "";
  private balance: Map<string, ISpotBalanceItem> = new Map();
  protected spotSymbolsInfoByMarketName: Map<string, ISpotSymbolItemAdapter> =
    new Map();
  protected spotSymbolsInfo: Map<string, ISpotSymbolItemAdapter> = new Map();
  public constructor(accountId: string) {
    this.accountId = accountId;
    logger.info("adapter_spot init", this.accountId);
  }
  public getOrderExecModel() {
    return IOrderExecModel.SYNC;
  }
  public async loadBalance(): Promise<void> {
    const spotBalanceUrl = `${adapterConfig.getAdapterServiceBaseUrl()}/api/spotBalances?accountId=${
      this.accountId
    }`;
    logger.debug(
      `Loading balance information...`,
      `${adapterConfig.getAdapterServiceBaseUrl()}/api/spotBalances?accountId=${
        this.accountId
      }`
    );
    try {
      const response = await axios.request({
        url: spotBalanceUrl,
        method: "get",
      });

      // logger.info(`Adapter loadBalances`);
      const retData = _.get(response, "data");
      const retCode = _.get(retData, "code", 1);

      if (retCode !== 0) {
        throw new Error(
          "Request for balances failed, expected status code 0 but received status code 1 instead."
        );
      }

      const balances: any = _.get(retData, "balances", {});

      this.saveBalances(balances);
    } catch (e: any) {
      logger.error("Fetch spot balances error:", e);
    }
  }
  private saveBalances(balances: {
    [asset: string]: {
      free: number;
      used: number;
      total: number;
    };
  }) {
    for (const asset in balances) {
      //   logger.info("save balance", asset);
      this.balance.set(asset, {
        asset,
        free: balances[asset].free.toString(),
        used: balances[asset].used.toString(),
        locked: (balances[asset].total - balances[asset].free).toString(),
      });
    }
  }
  public async loadMarkets(): Promise<void> {
    logger.debug(`loadMarkets`);
    try {
      const fetchMarketsUrl = `${adapterConfig.getAdapterServiceBaseUrl()}/api/public/fetchMarkets`;
      logger.info("fetch markets url:", fetchMarketsUrl);
      const response = await axios.request({
        url: fetchMarketsUrl,
        method: "get",
      });
      logger.info(`Adapter loadMarkets`);
      const retData = _.get(response, "data");
      const retCode = _.get(retData, "code", 1);
      if (retCode !== 0) {
        throw new Error(
          "Request for markets failed, expected status code 0 but received status code 1 instead. "
        );
      }
      const retBody: any = _.get(retData, "markets", []);
      this.saveMarkets(retBody);
    } catch (e: any) {
      logger.error("fetch markets error:", e);
    }
  }

  public async refreshMarkets() {
    setInterval(() => {
      this.loadMarkets()
        .then(() => {
          logger.info("loaded markets ");
        })
        .catch((e) => {
          logger.error(e);
        });
    }, 1000 * 30);
  }
  public fetchMarkets(): Map<string, any> {
    return this.spotSymbolsInfo;
  }
  private async saveMarkets(symbolItemList: ISpotSymbolItemAdapter[]) {
    const spotSymbolsArray: ISpotSymbolItemAdapter[] | undefined = _.filter(
      symbolItemList,
      {
        type: `spot`,
        spot: true,
      }
    );
    if (!spotSymbolsArray) {
      logger.warn("markets is empty");
      return;
    }
    logger.info("loaded markets count :", spotSymbolsArray.length);
    spotSymbolsArray.forEach((value) => {
      const stdSymbol = `${value.base}/${value.quote}`;
      _.set(value, "stdSymbol", stdSymbol);
      this.spotSymbolsInfo.set(stdSymbol, value);
      // logger.debug("set Symbol", stdSymbol, value);
      this.spotSymbolsInfoByMarketName.set(value.lowercaseId, value);
    });
  }
  /**
   * @todo impt
   * @param stdSymbol
   * @param price
   * @returns
   */
  public async getTradeMinMax(
    stdSymbol: string,
    price: number
  ): Promise<[number, number]> {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      logger.warn(`symbol info not fount `);
      return [0, 0];
    }
    const minNotional = _.get(symbolInfo, "limits.cost.min", 0);
    const maxNotional = _.get(symbolInfo, "limits.cost.max", 0);
    console.log("minNotional", minNotional, "maxNotional", maxNotional);
    logger.info({
      title: "getTradeMinMax",
      info: [
        `${minNotional}/${price}`,
        `${maxNotional}/${price}`,
        SystemMath.execNumber(`${minNotional}/${price}`),
        SystemMath.execNumber(`${maxNotional}/${price}`),
      ],
    });
    return [
      SystemMath.execNumber(`${minNotional}/${price}`),
      SystemMath.execNumber(`${maxNotional}/${price}`),
    ];
  }
  private getSymbolInfoByStdSymbol(stdSymbol: string) {
    const info = this.spotSymbolsInfo.get(stdSymbol);
    if (!info) {
      return null;
    }
    return info;
  }
  /**
   * @todo impt
   * @param stdSymbol
   * @returns
   */
  public async getTradeMinMaxValue(
    stdSymbol: string
  ): Promise<[number, number]> {
    if (stdSymbol === "T/USDT") {
      return [0, 0];
    }
    const symbolInfo = this.spotSymbolsInfo.get(stdSymbol);
    if (!symbolInfo) {
      logger.warn(`No trading pair information found ${stdSymbol}`);
      return [0, 0];
    }

    const minNotional = _.get(symbolInfo, "limits.cost.min", 0);
    const maxNotional = _.get(symbolInfo, "limits.cost.max", 0);
    logger.info({
      title: "getTradeMinMaxValue",
      info: [
        `${minNotional}`,
        `${maxNotional}`,
        SystemMath.execNumber(`${minNotional} * 1`),
        SystemMath.execNumber(`${maxNotional} * 1`),
      ],
    });
    return [
      SystemMath.execNumber(`${minNotional} * 1`),
      SystemMath.execNumber(`${maxNotional} * 1`),
    ];
  }
  /**
   * @todo impt
   * @param stdSymbol
   * @param value
   * @param amount
   * @returns
   */
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
      this.filters_NOTIONAL(item, value); // NOTIONAL
      logger.info(`filters_LOT_SIZE`);
      this.filters_LOT_SIZE(item, amount);
      return true;
    } catch (e) {
      logger.error(e);
      return false;
    }
  }
  private filters_NOTIONAL(item: ISpotSymbolItemAdapter, value: number) {
    /**
     * okx data like this:
     *
  limits: {
    leverage: { min: 1, max: 10 },
    amount: { min: 0.0001, max: null },
    price: { min: null, max: null },
    cost: { min: null, max: 1000000 }
  },
     */
    const minNotional = Number(_.get(item, "limits.cost.min", 0));

    if (!minNotional) {
      logger.warn("No minnotional setting was found.");
      // throw new Error("No minnotional setting was found.");
    }
    if (value > minNotional) {
      return;
    }
    logger.warn(
      `The transaction volume does not meet the minimum order limit`,
      value,
      minNotional,
      {
        status: { limits: _.get(item, "limits.cost", {}) },
        symbolInfo: {
          id: _.get(item, "id"),
          symbol: _.get(item, "symbol")
        },
      }
    );
    throw new Error(
      `The transaction volume does not meet the minimum order limit input:${value} ${minNotional}`
    );
  }
  /**
   * @todo test
   *
   */
  private filters_LOT_SIZE(item: ISpotSymbolItemAdapter, value: number) {
    if (!item || !_.get(item, "limits.amount.min", undefined)) {
      logger.warn("filter not found", item);
      return;
    }

    const min = Number(_.get(item, "limits.amount.min"));
    const max = Number(
      _.get(item, "item.limits.amount.max", Number.MAX_SAFE_INTEGER)
    );
    if (value >= min && value <= max) {
      return;
    }
    logger.warn(`The transaction amount error LOT_SIZE`, value, min, max);
    throw new Error(
      `The transaction amount error LOT_SIZE value [${value}] , filter [${min}] [${max}]`
    );
  }

  /**
   * @todo impl
   * @param stdSymbol
   * @returns
   */
  public async getTradeMinNotional(stdSymbol: string): Promise<number> {
    return 0;
  }
  /**
   * @todo impl
   * exchange need load from config
   */
  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber | undefined,
    quoteOrderQty: BigNumber | undefined,
    side: ISide,
    targetPrice: BigNumber | undefined,
    simulation = false
  ): Promise<ISpotOrderResult> {
    logger.debug("summary info", {
      side,
      amount: amount?.toString(),
      targetPrice: targetPrice?.toString(),
      simulation,
    });

    logger.debug(
      `create order symbol info is: ${stdSymbol}`
      // this.spotSymbolsInfo.get(stdSymbol)
    );
    const symbol = this.getSymbolByStdSymbol(stdSymbol);
    if (!symbol) {
      logger.error(
        `Can't create order,the Symbol information of the transaction cannot be found......FindOption
        spotSymbolsInfo Size: ${this.spotSymbolsInfo.size}
        ${stdSymbol}`
      );
      throw new Error(
        `Can't create order,the Symbol information of the transaction cannot be found:${stdSymbol}`
      );
    }
    const tradeInfo = this.spotSymbolsInfo.get(stdSymbol);
    if (!tradeInfo) {
      logger.error(
        `Unable to find transaction information......FindOption`,
        stdSymbol
      );
      throw new Error(`Unable to find transaction information:${stdSymbol}`);
    }
    logger.debug(
      `Ready to create an order........stdSymbol:${stdSymbol},symbol:${symbol}`
    );
    const orderData = {
      accountId: this.accountId,
      exchange: "binance",
      clientOrderId: orderId,
      market: stdSymbol,
      side,
      post_only: false,
      timestamp: new Date().getTime(),
    };
    logger.info("setAmountOrQty", stdSymbol, amount?.toString(), quoteOrderQty);
    this.setAmountOrQty(
      stdSymbol,
      amount,
      quoteOrderQty,
      orderData,
      tradeInfo.limits
    );

    let lostAmount = "";
    const origAmount = amount?.toString();
    logger.debug(`User ${this.accountId} create order:`);
    console.dir(orderData, { depth: 5 });
    lostAmount = _.get(orderData, "lostAmount", "");
    // delete orderData["lostAmount"];
    let result, orderUrl;
    orderUrl = `${adapterConfig.getAdapterServiceBaseUrl()}/api/order/createMarketOrder?accountId=${
      this.accountId
    }`;
    if (simulation === true) {
      orderUrl = `${adapterConfig.getAdapterServiceBaseUrl()}/api/order/simulationCreateMarketOrder?accountId=${
        this.accountId
      }`;
    }
    try {
      result = await axios.request({
        url: orderUrl,
        method: "POST",
        headers: {
          accountId: this.accountId,
        },
        data: orderData,
      });
      logger.info(
        "exchange adapter service response:",
        JSON.stringify(_.get(result, "data"))
      );
      // console.log("||||||||||||");
      _.set(result, "data.result.stdSymbol", stdSymbol);
      _.set(result, "data.result.inputInfo", {
        amount: _.get(orderData, "quantity", ""),
        lostAmount,
        origAmount,
      });

      logger.debug("order complete", "result:");
      console.log("_______________________________:exec result:");
      const execResult = this.formatMarketResponse(
        _.get(result, "data.result", {})
      );
      console.dir(execResult, {
        depth: 5,
      });
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
  private formatMarketResponse(retData: any): ISpotOrderResult {
    // console.dir(retData, { depth: 5 });
    const result: ISpotOrderResult = {
      side: (() => {
        return _.get(retData, "side", "");
      })(),
      orderId: retData.id,
      lostAmount: _.get(retData, "inputInfo.lostAmount", ""),
      origAmount: _.get(retData, "inputInfo.origAmount", ""),
      type: _.get(retData, "type", ""),
      timeInForce: _.get(retData, "timeInForce", ""),
      fee: this.getOrderFee(retData),
      info: JSON.stringify(retData),
      symbol: retData.symbol,
      stdSymbol: _.get(retData, "stdSymbol", ""),
      amount: _.get(retData, "amount", 0),
      price: _.get(retData, "price", 0).toString(),
      filled: _.get(retData, "filled"),
      remaining: _.get(retData, "remaining", 0),
      clientOrderId: retData.clientOrderId,
      timestamp: _.get(retData, "timestamp", 0),
      lastTradeTimestamp: _.get(retData, "lastTradeTimestamp", 0),
      average: _.get(retData, "average", 0).toString(),
      averagePrice: _.get(retData, "average", 0).toString(),
      status: _.get(retData, "status"),
    };
    return result;
  }
  /**
   * @todo impl
   * @param retData
   * @returns
   */
  private getOrderFee(retData: any): { [key: string]: string } {
    const fee = {};
    const fees: { fee: { cost: number; currency: string } }[] = _.get(
      retData,
      "trades",
      []
    );
    // console.log("fees list is :", fees);
    fees.map((it) => {
      const curCommission: any | undefined = _.get(
        fee,
        it.fee.currency,
        undefined
      );
      if (!curCommission) {
        _.set(fee, it.fee.currency, new BigNumber(it.fee.cost).toString());
        return null;
      }
      const BnNumber = new BigNumber(curCommission);
      const feeVal = BnNumber.plus(new BigNumber(it.fee.cost));
      _.set(fee, it.fee.currency, feeVal.toString());
      return null;
    });
    return fee;
  }

  private setAmountOrQty(
    stdSymbol: string,
    amount: BigNumber | undefined,
    qty: BigNumber | undefined,
    struct: any,
    limits: any
  ) {
    if (amount !== undefined) {
      if (_.isNumber(limits.amount.min)) {
        const stepSize = limits.amount.min;
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
      } else {
        throw new Error("limit.amount min value error");
      }
    }

    if (qty !== undefined) {
      throw new Error("Not yet implemented");
    }
  }
  private formatBigNumberPrecision(stdSymbol: string, value: any): string {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      throw new Error("symbolInfo not found");
    }
    const assetPrecision = symbolInfo.precision.quote;
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
  private getSymbolByStdSymbol(stdSymbol: string) {
    const info = this.spotSymbolsInfo.get(stdSymbol);
    if (!info) {
      return null;
    }
    return info.lowercaseId;
  }
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
}
export { AdapterSpot };
