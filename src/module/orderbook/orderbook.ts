import { IOrderbookStoreItem } from "../../interface/interface";
import { ISymbolsManager } from "../../interface/symbols_manager";
import { CexOrderbook } from "./cex_orderbook";
import { PortfolioOrderbook } from "./portfolio_orderbook";

class Orderbook {
  private provider: CexOrderbook | PortfolioOrderbook;
  get spotOrderbookOnceLoaded() {
    return this.provider.spotOrderbookOnceLoaded;
  }

  public getSpotOrderbook(stdSymbol: string): IOrderbookStoreItem | undefined {
    return this.provider.getSpotOrderbook(stdSymbol);
  }

  public refreshOrderbook() {
    return this.provider.refreshOrderbook();
  }
  public setSymbolsManager(symbolsManager: ISymbolsManager | undefined) {
    this.provider.setSymbolsManager(symbolsManager);
  }

  public init() {
    this.provider = new PortfolioOrderbook();
    this.provider.init();
  }
}

const orderbook: Orderbook = new Orderbook();
export { orderbook };
