import {
  ISpotSymbolItemPortfolio,
  ISpotBalanceItemPortfolio,
  IOrderTypePortfolio,
} from "../../../../interface/cex_portfolio";
import { IStdExchangeSpot } from "../../../../interface/std_exchange";
import { logger } from "../../../../sys_lib/logger";
import { portfolioConfig } from "./portfolio_config";
import BigNumber from "bignumber.js";
import * as _ from "lodash";
import {
  ISide,
  ISpotBalanceItem,
  ISpotOrderResult,
} from "../../../../interface/std_difi";
import { PortfolioRequest } from "./request/portfolio_request";
import { SystemMath } from "../../../../utils/system_math";
import { formatStepSize } from "../../utils";
const querystring = require("node:querystring");
class PortfolioSpot implements IStdExchangeSpot {
  public exchangeName: string;
  private accountId: string;
  private balance: Map<string, ISpotBalanceItemPortfolio> = new Map();

  private apiBaseUrl = "";
  protected spotSymbolsInfo: Map<string, ISpotSymbolItemPortfolio> = new Map();

  public constructor(accountId: string) {
    this.accountId = accountId;
    this.apiBaseUrl = portfolioConfig.apiBaseUrl;
  }

  public async initMarkets(): Promise<void> {
    const url = `https://cex-api.bttcdn.com/trade/getMarketInfo?exchange=2`;
    const pr: PortfolioRequest = new PortfolioRequest();
    logger.info(url);
    const marketResult = await pr.get(url);
    this.saveMarkets(_.get(marketResult, "data", []));
  }

  private saveMarkets(symbolItemList: ISpotSymbolItemPortfolio[]): void {
    const spotSymbolsArray: ISpotSymbolItemPortfolio[] | undefined = _.filter(
      symbolItemList,
      {
        exchange_name: `binance_spot`,
      }
    );
    if (!spotSymbolsArray) {
      return;
    }
    spotSymbolsArray.forEach((value) => {
      const stdSymbol = `${value.base_coin}/${value.quote_coin}`;
      _.set(value, "stdSymbol", stdSymbol);
      this.spotSymbolsInfo.set(stdSymbol, value);
    });
  }

  public fetchMarkets(): Map<string, any> {
    return this.spotSymbolsInfo;
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
    } catch (e) {
      logger.error(e);
      return false;
    }
    return true;
  }

  private filters_NOTIONAL(
    symbolInfoItem: ISpotSymbolItemPortfolio,
    value: number
  ) {
    const setMin = _.get(symbolInfoItem, "min_trade_quote", 0);
    logger.warn(`setMin`, setMin);
    if (value > setMin) {
      return;
    }
    logger.warn(
      `The transaction volume does not meet the minimum order limit`,
      value,
      setMin
    );
    throw new Error(
      `The transaction volume does not meet the minimum order limit input:${value} ${setMin}`
    );
  }
  private filters_LOT_SIZE(item: ISpotSymbolItemPortfolio, value: number) {
    const min = Number(item.min_trade_amount);
    const max = Number(item.max_trade_amount);
    if (value >= min && value <= max) {
      return;
    }
    logger.warn(`The transaction amount error LOT_SIZE`, value, min, max);
    throw new Error(
      `The transaction amount error LOT_SIZE value [${value}] , filter [${min}] [${max}]`
    );
  }
  public async fetchBalance(): Promise<void> {
    const balanceUrl = `${this.apiBaseUrl}/trade/getAccount`;
    const pr: PortfolioRequest = new PortfolioRequest();
    logger.info(balanceUrl);
    const balanceResult = await pr.get(balanceUrl);
    // logger.info(`fetchBalance`, balanceResult);
    logger.info(`fetchBalance`);
    this.saveBalance(_.get(balanceResult, "data", []));
  }

  private saveBalance(
    balanceResultList: {
      account_name: string;
      spot_balances: [key: string, val: { avaiable: number; total: number }];
    }[]
  ) {
    // logger.info(`saveBalance`, this.accountId, balanceResultList);
    const accountSpotBalanceInfo = _.find(balanceResultList, {
      account_name: this.accountId,
      exchange_name: "binance_spot",
    });
    if (!accountSpotBalanceInfo) {
      logger.warn(`Balance information not found`);
      return;
    }
    const keys = Object.keys(
      _.get(accountSpotBalanceInfo, "spot_balances", [])
    );
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const total = accountSpotBalanceInfo["spot_balances"][key]["total"];
      const free = accountSpotBalanceInfo["spot_balances"][key]["avaiable"];
      const locked = SystemMath.execNumber(`${total} - ${free}`).toString();
      this.balance.set(key, {
        asset: key,
        free,
        locked,
      });
    }
    // logger.info(accountSpotBalanceInfo);
  }

  /**
   * get Trade min max amount
   * @date 2023/5/23 - 17:00:29
   *
   * @public
   * @async
   * @param {string} stdSymbol "eth/usdt"
   * @param {number} price ""
   * @returns {Promise<[number, number]>} "min max"
   */
  public async spotGetTradeMinMax(
    stdSymbol: string,
    price: number
  ): Promise<[number, number]> {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      logger.warn(`symbol info not fount `);
      return [0, 0];
    }
    const minQuote = _.get(symbolInfo, "min_trade_quote", 0);
    const maxQuote = _.get(symbolInfo, "max_trade_quote", 0);
    return [
      SystemMath.execNumber(`${minQuote}/${price}`),
      SystemMath.execNumber(`${maxQuote}/${price}`),
    ];
  }

  public async spotGetTradeMinMaxValue(
    stdSymbol: string
  ): Promise<[number, number]> {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      logger.warn(`symbol info not fount `);
      return [0, 0];
    }
    const minQuote = _.get(symbolInfo, "min_trade_quote", 0);
    const maxQuote = _.get(symbolInfo, "max_trade_quote", 0);
    return [
      SystemMath.execNumber(`${minQuote} * 1`),
      SystemMath.execNumber(`${maxQuote} * 1`),
    ];
  }

  public async spotGetTradeMinNotional(stdSymbol: string): Promise<number> {
    if (stdSymbol === "T/USDT") {
      return 0;
    }
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      logger.warn(`symbol info not fount `);
      return 0;
    }
    return symbolInfo.min_trade_quote;
  }

  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber | undefined,
    quoteOrderQty: BigNumber | undefined,
    side: ISide,
    targetPrice: BigNumber | undefined,
    simulation = false
  ): Promise<ISpotOrderResult> {
    console.dir(this.spotSymbolsInfo.get(stdSymbol));
    const symbol = this.getSymbolByStdSymbol(stdSymbol);

    if (!symbol) {
      logger.error(
        `The Symbol information of the transaction cannot be found......FindOption`,
        stdSymbol
      );
      throw new Error(
        `The Symbol information of the transaction cannot be found:${stdSymbol}`
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
      client: this.accountId,
      exchange: 2,
      client_id: orderId,
      market: symbol,
      price: targetPrice?.toString(8),
      side: side.toLocaleLowerCase(),
      order_type: IOrderTypePortfolio.Market.toLocaleLowerCase(),
      post_only: false,
    };
    this.setAmountOrQty(stdSymbol, amount, quoteOrderQty, orderData, tradeInfo);
    await this.sendOrderToPortfolio(orderData);
    logger.info("let's create an order", orderData);
    const c: any = "";
    return c;
  }
  private async sendOrderToPortfolio(orderData: any) {
    /** {
    code: 0,
    data: {
      status: 'success'
    } */
    // const pr: PortfolioRequest = new PortfolioRequest();
    const qStr = querystring.stringify(orderData);
    logger.debug(qStr);
    const requestUrl = `https://cex-api.bttcdn.com/trade/createOrder?${qStr}`;
    logger.debug(requestUrl);
    return true;
    // const createOrderResponse = await pr.get(
    //   `https://cex-api.bttcdn.com/trade/createOrder?${qStr}`
    // );
    // logger.debug(`create order response:`, createOrderResponse);
  }

  private setAmountOrQty(
    stdSymbol: string,
    amount: BigNumber | undefined,
    qty: BigNumber | undefined,
    struct: any,
    tradeInfo: ISpotSymbolItemPortfolio
  ) {
    if (amount !== undefined) {
      const [tradeAmount, lostAmount] = formatStepSize(
        amount.toString(),
        tradeInfo.size_tick.toString()
      );
      _.set(
        struct,
        "size",
        this.formatBigNumberPrecision(stdSymbol, new BigNumber(tradeAmount))
      );
      _.set(struct, "lostAmount", new BigNumber(lostAmount).toString());
    }
  }

  private getSymbolInfoByStdSymbol(stdSymbol: string) {
    const info = this.spotSymbolsInfo.get(stdSymbol);
    if (!info) {
      return null;
    }
    return info;
  }

  private formatBigNumberPrecision(stdSymbol: string, value: any): string {
    const symbolInfo = this.getSymbolInfoByStdSymbol(stdSymbol);
    if (!symbolInfo) {
      throw new Error("symbolInfo not found");
    }

    const assetPrecision = _.get(symbolInfo, "size_decmil_len", undefined);
    logger.debug(`coin qoote decmil`, assetPrecision);
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
    return info.market_name;
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

export { PortfolioSpot };
