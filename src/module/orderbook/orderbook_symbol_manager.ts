import { dataConfig } from "../../data_config";
import { ISymbolsManager } from "../../interface/symbols_manager";
import { tokensModule } from "../../mongo_module/tokens";
import { logger } from "../../sys_lib/logger";
import { PortfolioRequest } from "../exchange/cex_exchange/portfolio/request/portfolio_request";
import * as _ from "lodash";
const md5 = require("md5");

class OrderbookSymbolManager implements ISymbolsManager {
  private skipSymbols: string[] = ["USDT"];
  private spotSymbols: string[] = [];
  private spotSymbolsHash: string;
  private spotSymbolAlreadySubscribed: Map<string, boolean> = new Map();

  public init() {
    this.syncSpotTokens();
  }
  public getSpotSymbols() {
    const list: string[] = [];
    // eslint-disable-next-line array-callback-return
    this.spotSymbols.map((it) => {
      if (it !== "USDT") {
        list.push(`${it}USDT`);
      }
    });
    return list;
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
      logger.error(`loadToken error:`, e);
    }
  }

  private saveSpotTokenList(uniqTokenList: { marketName: string }[]) {
    let symbolList: string[] = [];
    for (let i = 0; i < uniqTokenList.length; i++) {
      symbolList.push(uniqTokenList[i].marketName);
    }
    dataConfig.getChainTokenMap().forEach((item) => {
      symbolList.push(item);
    });
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
        logger.info(`start subscribing market:`, `${this.spotSymbols[i]}USDT`);
        await this.requestSubscription(`${this.spotSymbols[i]}USDT`);
        this.spotSymbolAlreadySubscribed.set(this.spotSymbols[i], true); // mark subscribed
      }
    }
    logger.info(`Subscribe Ready List`, JSON.stringify(this.spotSymbols));
  }

  private async requestSubscription(marketSymbol: string) {
    try {
      const pr: PortfolioRequest = new PortfolioRequest();
      const tobeSend = {
        exchange: "15",
        market: marketSymbol,
      };
      logger.debug("addSubMarkets", JSON.stringify(tobeSend));
      const subResponse = await pr.post("AddSubMarkets", tobeSend);
      const symbolArr = _.get(subResponse, "data", []);
      if (symbolArr.length >= 1) {
        return true;
      }
      logger.warn(`subscription failed ${marketSymbol}`);
      return false;
    } catch (e) {
      logger.error(`send market subscription error${e}`);
    }
  }
}

const orderbookSymbolManager: OrderbookSymbolManager =
  new OrderbookSymbolManager();
export { orderbookSymbolManager, OrderbookSymbolManager };
