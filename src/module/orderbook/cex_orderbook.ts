/**
 * It is used to synchronize the order book data of Cex market service. The current market service already supports spot currency perpetual and U perpetual
 */
import { Console } from "console";
import {
  IMarketOrderbookRet,
  IOrderbookStoreItem,
} from "../../interface/interface";
import { IOrderbook } from "../../interface/orderbook";
import { ISymbolsManager } from "../../interface/symbols_manager";
import { getNewRedis } from "../../redis_bus";
import { eventBus } from "../../sys_lib/event.bus";
import { logger } from "../../sys_lib/logger";
const marketRedisIns = getNewRedis()
const axios = require("axios");
import * as _ from "lodash";

class CexOrderbook implements IOrderbook {
  private spotOrderbook: Map<string, IOrderbookStoreItem> = new Map();
  public spotOrderbookOnceLoaded = false;
  private model = "REDIS" // HTTP
  // public cumulativeErrorCount = 0;

  public getSpotOrderbook(stdSymbol: string): IOrderbookStoreItem | undefined {
    const orderbookItem = this.spotOrderbook.get(stdSymbol);

    if (orderbookItem) {
      const timeNow = new Date().getTime();
      // logger.info(
      //   "orderbook timestamp:",
      //   orderbookItem.timestamp,
      //   "timeNow:",
      //   timeNow,
      //   "diff:",
      //   timeNow - orderbookItem.timestamp
      // );
      if (timeNow - orderbookItem.timestamp > 1000 * 60) {
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

  public setSymbolsManager(symbolsManager: ISymbolsManager | undefined) {
    logger.info("do nothing");
  }

  public async init(): Promise<void> {
    logger.debug("Initialize Cex_orderbook..");
    this.startOrderbookGc();
    _.attempt(async () => {
      await this.syncSpotOrderbook();
      logger.debug("orderbook:load:complete ->EventBus");
      eventBus.emit("orderbook:load:complete");
    });
  }

  /**
   * Description Regularly delete expired Cex_orderbook data to avoid unexpected situations
   * @date 1/17/2023 - 8:54:28 PM
   * @private
   * @returns {void} ""
   */
  private startOrderbookGc(): void {
    logger.debug("timing Gc overdue orderbook item.");
  }

  /**
   * Description Start synchronizing spot orderbook to memory
   * @date 1/17/2023 - 9:00:41 PM
   *
   * @private
   * @async
   * @returns {Promise<void>} ""
   */
  private async syncSpotOrderbook(): Promise<void> {
    try {
      if (this.model == "REDIS") {
        await this.requestSpotOrderbookByRedis(); // Update and set up Spotorderbook  
      }
      if (this.model === "HTTP") {
        await this.requestSpotOrderbook()
      }


      // logger.info("orderbook load sucess");
      this.spotOrderbookOnceLoaded = true;
    } catch (e) {
      logger.error(`synchronizing orderbook error:`, e);
    }

    setTimeout(() => {
      this.syncSpotOrderbook();
    }, 1000 * 5);
  }

  /**
   * Description Immediately refresh the Cex_orderbook once
   * @date 2023/2/8 - 14:06:47
   *
   * @public
   * @async
   * @returns {*} ""
   */
  public async refreshOrderbook() {
    try {
      if (this.model == "REDIS") {
        await this.requestSpotOrderbookByRedis(); // Update and set up Spotorderbook  
      }
      if (this.model === "HTTP") {
        await this.requestSpotOrderbook()
      }
    } catch (e) {
      logger.error(e);
    }
  }

  private async requestSpotOrderbook() {
    try {
      const orderbookServiceHost = _.get(
        process,
        "_sys_config.lp_market_host",
        undefined
      );
      const orderbookServicePort = _.get(
        process,
        "_sys_config.lp_market_port",
        undefined
      );
      if (
        !orderbookServiceHost &&
        !_.get(process.env, "LP_MARKET_SERVICE_URL", undefined)
      ) {
        throw "Unable to obtain orderbook service address";
      }
      let url = `http://${orderbookServiceHost}:${orderbookServicePort}/api/spotOrderbook`;
      if (_.get(process.env, "LP_MARKET_SERVICE_URL", undefined)) {
        url = _.get(process.env, "LP_MARKET_SERVICE_URL", "");
      }
      // logger.info(`request orderbook Url:`, url);
      const result = await axios.request({
        url,
        method: "get",
        timeout: 1000 * 10,
      });
      const code = _.get(result, "data.code", { code: 1 });
      const data: IMarketOrderbookRet = _.get(result, "data.data", {});
      if (code !== 0) {
        logger.error("An error occurred while obtaining the orderbook");
        return;
      }
      for (const key in data) {
        // update local orderbook data
        // @ts-ignore
        this.spotOrderbook.set(key, data[key]);
        // @ts-ignore
        // console.log(key, data[key])
      }
    } catch (e) {
      const error: any = e;
      logger.error(
        `An error occurred while obtaining the orderbook....`,
        error.toString()
      );
      throw e;
    }
  }

  private async requestSpotOrderbookByRedis() {
    const symbolsStr = await marketRedisIns.get("LP_MARKET_SYMBOLS")
    const symbols = JSON.parse(symbolsStr);
    for (let symbol of symbols) {
      const orderbookStr = await marketRedisIns.get(symbol)
      const orderbook = JSON.parse(orderbookStr)
      if (!_.get(orderbook, "bids", undefined)) {
        logger.warn(`empty bid orderbook ${symbol}`)
        continue;
      }
      const bids = (orderbook.bids as number[][]).map(bid => bid.map(item => item.toString()));
      const asks = (orderbook.asks as number[][]).map(ask => ask.map(item => item.toString()));
      const orderbookItem: IOrderbookStoreItem = {
        stdSymbol: orderbook.symbol,
        symbol: orderbook.symbol,
        lastUpdateId: 0,
        timestamp: orderbook.timestamp,
        incomingTimestamp: Date.now(),
        stream: 'spot',
        bids,
        asks
      };
      this.spotOrderbook.set(symbol, orderbookItem)
    }

  }

  /**
   * Description  get real-time quotes
   * @date 1/17/2023 - 9:01:26 PM
   *
   * @public
   * @async
   * @param {string} stdSymbol "ETH/USDT"
   * @returns {*} ""
   */
  public async getRealTimeMarket(stdSymbol: string) {
    // @todo
  }
}

export { CexOrderbook };
