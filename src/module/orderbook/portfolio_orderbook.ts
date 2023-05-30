const querystring = require("node:querystring");
import { IOrderbookStoreItem } from "../../interface/interface";
import { IOrderbook } from "../../interface/orderbook";
import { eventBus } from "../../sys_lib/event.bus";
import { logger } from "../../sys_lib/logger";
import { ISymbolsManager } from "../../interface/symbols_manager";
import { PortfolioRequest } from "../exchange/cex_exchange/portfolio/request/portfolio_request";
import * as _ from "lodash";
import { ISpotSymbolItemPortfolio } from "../../interface/cex_portfolio";
import { portfolioConfig } from "../exchange/cex_exchange/portfolio/portfolio_config";
class PortfolioOrderbook implements IOrderbook {
  public spotOrderbookOnceLoaded = false;
  private spotOrderbook: Map<string, IOrderbookStoreItem> = new Map();
  private symbolsManager: ISymbolsManager | undefined = undefined;
  protected spotSymbolsInfo: Map<string, ISpotSymbolItemPortfolio> = new Map();
  protected spotSymbolsInfoByMarketName: Map<string, ISpotSymbolItemPortfolio> =
    new Map();
  public getSpotOrderbook(stdSymbol: string): IOrderbookStoreItem | undefined {
    const orderbookItem = this.spotOrderbook.get(stdSymbol);
    if (orderbookItem) {
      const timeNow = new Date().getTime();
      if (timeNow - orderbookItem.timestamp > 1000 * 30) {
        logger.warn(
          `order book expired.`,
          (timeNow - orderbookItem.timestamp) / 1000,
          "sec"
        );
        return undefined;
      }
      return orderbookItem;
    }
    return undefined;
  }
  private async initMarkets() {
    const url = `${portfolioConfig.getBaseApi("markets")}?exchange=15`;
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
      this.spotSymbolsInfoByMarketName.set(value.market_name, value);
      this.spotSymbolsInfo.set(stdSymbol, value);
    });
  }
  public async init(): Promise<void> {
    logger.debug(`orderbook init`);
    await this.initMarkets();
    await this.syncSpotOrderbook();
    await eventBus.emit("orderbook:load:complete");
  }

  public async refreshOrderbook() {
    //
  }
  public setSymbolsManager(symbolsManager: ISymbolsManager | undefined) {
    this.symbolsManager = symbolsManager;
  }
  private async syncSpotOrderbook() {
    try {
      await this.requestSpotOrderbook();
    } catch (e) {
      logger.error(`synchronizing orderbook error:`, e);
    }

    setTimeout(() => {
      this.syncSpotOrderbook();
    }, 1000 * 30);
  }

  private async requestSpotOrderbook() {
    this.spotOrderbookOnceLoaded = true;
    if (!this.symbolsManager) {
      logger.warn(`symbolsManager not found`);
      return;
    }
    const spotSymbols = this.symbolsManager.getSpotSymbols();
    logger.debug("list all symbols", spotSymbols);
    const qStr = querystring.stringify({
      exchange: 15,
      market: spotSymbols.join(","),
    });
    const url = `${portfolioConfig.getBaseApi("getDepth")}?${qStr}`;
    logger.debug("request", url);
    const pr: PortfolioRequest = new PortfolioRequest();
    const orderbookResponse = await pr.get(url);
    this.saveSpotOrderbook(_.get(orderbookResponse, "data", {}));
  }
  private saveSpotOrderbook(orderBookResult: any) {
    logger.info(`save spotOrderbook 🦑`);
    const keys = Object.keys(orderBookResult);
    if (!_.isArray(keys) || keys.length === 0) {
      logger.debug(`empty return`);
      return;
    }
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const symbolInfo = this.spotSymbolsInfoByMarketName.get(key);
      const itemValue = orderBookResult[key];
      if (symbolInfo) {
        const item = {
          stdSymbol: symbolInfo.stdSymbol,
          symbol: symbolInfo.market_name,
          lastUpdateId: 0,
          timestamp: (() => {
            const millisecond = _.get(itemValue, "time", 0) * 1000;
            return parseInt(millisecond.toString());
          })(),
          incomingTimestamp: new Date().getTime(),
          stream: "",
          bids: this.convertAsksOrBidsToString(
            _.get(itemValue, "depth.bids", [])
          ),
          asks: this.convertAsksOrBidsToString(
            _.get(itemValue, "depth.asks", [])
          ),
        };
        if (item.asks.length > 0 && item.bids.length > 0) {
          this.spotOrderbook.set(symbolInfo.stdSymbol, item);
        }
      } else {
        logger.error(`${key} not found`);
        continue;
      }
    }
  }
  private convertAsksOrBidsToString(data: number[][]) {
    if (!_.isArray(data) || data.length <= 0) {
      logger.error(
        `asks or bids format error`,
        typeof data,
        JSON.stringify(data)
      );
      return [];
    }
    return data.map((it) => {
      return [it[0].toString(), it[1].toString()];
    });
  }
}

export { PortfolioOrderbook };
