/**
 * It is used to synchronize the order book data of Cex market service. The current market service already supports spot currency perpetual and U perpetual
 * 2023年01月13日19:22:05
 */
import {
  IMarketOrderbookRet,
  IOrderbookStoreItem,
} from "../interface/interface";
import { eventBus } from "../sys_lib/event.bus";
import { logger } from "../sys_lib/logger";

const axios = require("axios");
import * as _ from "lodash";

class Orderbook {
  private spotOrderbook: Map<string, IOrderbookStoreItem> = new Map();
  public spotOrderbookOnceLoaded = false;

  // public cumulativeErrorCount = 0;

  public getSpotOrderbook(stdSymbol: string): IOrderbookStoreItem | undefined {
    return this.spotOrderbook.get(stdSymbol);
  }

  public async init(): Promise<void> {
    logger.debug("初始化Orderbook..");
    this.startOrderbookGc();
    _.attempt(async () => {
      await this.syncSpotOrderbook();
      logger.debug("orderbook:load:complete ->EventBus");
      eventBus.emit("orderbook:load:complete");
    });
  }

  /**
   * Description Regularly delete expired Orderbook data to avoid unexpected situations
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
      await this.requestSpotOrderbook(); // Update and set up Spotorderbook
      this.spotOrderbookOnceLoaded = true;
    } catch (e) {
      //
    }

    setTimeout(() => {
      this.syncSpotOrderbook();
    }, 1000 * 5);
  }

  /**
   * Description Immediately refresh the Orderbook once
   * @date 2023/2/8 - 14:06:47
   *
   * @public
   * @async
   * @returns {*} ""
   */
  public async refreshOrderbook() {
    try {
      await this.requestSpotOrderbook();
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
      if (!orderbookServiceHost) {
        throw "Unable to obtain orderbook service address";
      }
      const url = `http://${orderbookServiceHost}:${orderbookServicePort}/api/spotOrderbook`;
      // logger.info(`request orderbook Url:`, url);
      const result = await axios.get(url);
      const code = _.get(result, "data.code", { code: 1 }); // 获取axios的data
      const data: IMarketOrderbookRet = _.get(result, "data.data", {});
      if (code !== 0) {
        logger.error("An error occurred while obtaining the orderbook");
        return;
      }
      for (const key in data) {
        // update local orderbook data
        this.spotOrderbook.set(key, data[key]);
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

const orderbook: Orderbook = new Orderbook();
export { orderbook };
