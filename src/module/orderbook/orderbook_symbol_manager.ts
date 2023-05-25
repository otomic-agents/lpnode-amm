import { ISymbolsManager } from "../../interface/symbols_manager";
import { tokensModule } from "../../mongo_module/tokens";
import { logger } from "../../sys_lib/logger";
import { PortfolioRequest } from "../exchange/cex_exchange/portfolio/request/portfolio_request";
import * as _ from "lodash";
const md5 = require("md5");

class OrderbookSymbolManager implements ISymbolsManager {
  private baseApiUrl = "https://cex-api.bttcdn.com";
  private skipSymbols: string[] = ["USDT"];
  private spotSymbols: string[];
  private spotSymbolsHash: string;
  private spotSymbolAlreadySubscribed: Map<string, boolean> = new Map();

  public init() {
    this.syncSpotTokens();
  }
  public getSpotSymbols() {
    return this.spotSymbols.map((it) => {
      return `${it}USDT`;
    });
  }

  private async syncSpotTokens() {
    this.loadTokens();
    setTimeout(() => {
      this.syncSpotTokens();
    }, 1000 * 30);
  }

  public async loadTokens() {
    try {
      const uniqTokenList: { marketName: string }[] =
        await tokensModule.aggregate([
          { $match: {} },
          {
            $group: {
              _id: "$marketName",
              tokenAddress: { $addToSet: "$marketName" },
              "{tokenAddressStr}": { $first: "$$ROOT.address" },
              marketName: { $first: "$$ROOT.marketName" },
            },
          },
        ]);
      this.saveSpotTokenList(uniqTokenList);
    } catch (e) {
      logger.error(`0000`);
    }
  }

  private saveSpotTokenList(uniqTokenList: { marketName: string }[]) {
    let symbolList: string[] = [];
    for (let i = 0; i < uniqTokenList.length; i++) {
      symbolList.push(uniqTokenList[i].marketName);
    }
    symbolList = symbolList.sort();
    const newMd5 = md5(symbolList.join(","));
    if (this.spotSymbolsHash !== newMd5) {
      this.spotSymbolsHash = newMd5;
      this.spotSymbols = symbolList;
      this.resubscription();
    } else {
      logger.info(`tokens no change`);
    }
  }

  private async resubscription() {
    for (let i = 0; i < this.spotSymbols.length; i++) {
      const isSubscription = this.spotSymbolAlreadySubscribed.get(
        this.spotSymbols[i]
      );
      if (isSubscription) {
        continue;
      }
      if (this.skipSymbols.includes(this.spotSymbols[i])) {
        continue;
      }
      if (!isSubscription) {
        logger.info(`start subscribing`, this.spotSymbols[i], "🐖");
        await this.requestSubscription(`${this.spotSymbols[i]}USDT`);
        this.spotSymbolAlreadySubscribed.set(this.spotSymbols[i], true); // mark subscribed
      }
    }
    logger.info(`subscription`, this.spotSymbols);
  }

  private async requestSubscription(marketSymbol: string) {
    const url = `${this.baseApiUrl}/trade/addSubMarkets?exchange=2&market=${marketSymbol}`;
    const pr: PortfolioRequest = new PortfolioRequest();
    logger.debug(`request`, url);
    const subResponse = await pr.get(url);
    const symbolArr = _.get(subResponse, "data", []);
    if (symbolArr.length >= 1) {
      return true;
    }
    logger.warn(`subscription failed ${marketSymbol}`);
    return false;
  }
}

const orderbookSymbolManager: OrderbookSymbolManager =
  new OrderbookSymbolManager();
export { orderbookSymbolManager, OrderbookSymbolManager };
