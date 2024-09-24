import { dataConfig } from "../../data_config";
import { IOrderbookStoreItem } from "../../interface/interface";
import { ISymbolsManager } from "../../interface/symbols_manager";
import { logger } from "../../sys_lib/logger";
import { CexOrderbook } from "./cex_orderbook";
import { PortfolioOrderbook } from "./portfolio_orderbook";
import * as _ from "lodash";

class Orderbook {
  private provider: CexOrderbook | PortfolioOrderbook;

  get spotOrderbookOnceLoaded() {
    return this.provider.spotOrderbookOnceLoaded;
  }

  public getSpotOrderbook(stdSymbol: string): IOrderbookStoreItem | undefined {
    const ret = this.provider.getSpotOrderbook(stdSymbol);
    // console.dir(ret, { depth: 5 });
    return ret;
  }

  public refreshOrderbook() {
    logger.debug("call refreshOrderbook");
    return this.provider.refreshOrderbook();
  }

  public setSymbolsManager(symbolsManager: ISymbolsManager | undefined) {
    this.provider.setSymbolsManager(symbolsManager);
  }

  public async init() {
    const orderbookType = _.get(
      dataConfig.getBaseConfig(),
      "orderBookType",
      "market"
    );
    if (orderbookType === "portfolio") {
      logger.debug(`init PortfolioOrderbook`);
      this.provider = new PortfolioOrderbook();
      this.provider.init();
      return;
    }
    if (orderbookType === "market") {
      logger.debug(`init CexOrderbook`);
      await dataConfig.rewriteMarketUrl();
      this.provider = new CexOrderbook();
      this.provider.init();
      return;
    }
  }
}

const orderbook: Orderbook = new Orderbook();
export { orderbook };
