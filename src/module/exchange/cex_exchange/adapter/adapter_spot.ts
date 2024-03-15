import { IStdExchangeSpot } from "../../../../interface/std_exchange";
import {
  IOrderExecModel,
  ISide,
  ISpotBalanceItem,
} from "../../../../interface/std_difi";
import BigNumber from "bignumber.js";
import axios from "axios";
import * as _ from "lodash";
import { logger } from "../../../../sys_lib/logger";
import { SystemMath } from "../../../../utils/system_math";
import { ISpotSymbolItemAdapter } from "../../../../interface/cex_adapter";
class AdapterSpot implements IStdExchangeSpot {
  public exchangeName = "binance";
  private accountId: string = "";
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
    logger.debug(`Loading balance information...`);
    try {
      const response = await axios.request({
        baseURL: "http://localhost:18080/api",
        url: "/spotBalances",
        method: "get",
      });

      logger.info(`Adapter loadBalances`);
      const retData = _.get(response, "data");
      const retCode = _.get(retData, "code", 1);

      if (retCode !== 0) {
        throw new Error(
          "Request for balances failed, expected status code 0 but received status code 1 instead."
        );
      }

      const balances: any = _.get(retData, "balances", {});

      // 假设SpotBalance是一个已定义的接口类型，用于存储余额信息
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
        asset: asset,
        free: balances[asset].free.toString(),
        used: balances[asset].used.toString(),
        locked: (balances[asset].total - balances[asset].free).toString(),
      });
    }
  }
  public async loadMarkets(): Promise<void> {
    logger.debug(`init markets.....`);
    try {
      const response = await axios.request({
        baseURL: "http://price-access:18080/api/public",
        url: "/fetchMarkets",
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
      this.filters_NOTIONAL(item, value);
      logger.info(`filters_LOT_SIZE`);
      this.filters_LOT_SIZE(item, amount);
      return true;
    } catch (e) {
      logger.error(e);
      return false;
    }
  }
  private filters_NOTIONAL(item: ISpotSymbolItemAdapter, value: number) {
    const minNotional = Number(_.get(item, "limits.cost.min", undefined));
    if (!minNotional) {
      logger.warn("No minnotional setting was found.");
      throw new Error("No minnotional setting was found.");
    }
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
    const max = Number(_.get(item, "item.limits.amount.max"));
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
   */
  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber | undefined,
    quoteOrderQty: BigNumber | undefined,
    side: ISide,
    targetPrice: BigNumber | undefined,
    simulation = false
  ): Promise<boolean> {
    return true;
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
