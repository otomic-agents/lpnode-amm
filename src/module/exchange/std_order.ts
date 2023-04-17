import * as _ from "lodash";
import { IStdExchange } from "../../interface/std_exchange";
import { ISide } from "../../interface/std_difi";
import BigNumber from "bignumber.js";
import { logger } from "../../sys_lib/logger";

class StdOrder {
  private stdExchange: IStdExchange; // cex 所的引用
  public constructor(cexExchange: IStdExchange) {
    this.stdExchange = cexExchange;
  }

  public async spotBuy(orderId: string, stdSymbol: string, amount: string | undefined, qty: string | undefined) {
    logger.debug(`spotBuy`, stdSymbol);
    return this.stdExchange.exchangeSpot.createMarketOrder(
      orderId,
      stdSymbol,
      (() => {
        if (amount) {
          return new BigNumber(`${amount}`);
        }
        return undefined;
      })(),
      (() => {
        if (qty) {
          return new BigNumber(`${qty}`);
        }
        return undefined;
      })(),
      ISide.BUY
    );
  }

  public async spotTradeCheck(stdSymbol: string, value: number, amount: number): Promise<boolean> {
    if (!_.isFinite(value)) {
      logger.error(`输入的量有问题.`, value);
      return false;
    }
    return this.stdExchange.exchangeSpot.spotTradeCheck(stdSymbol, value, amount);
  }

  public async getSpotTradeMinMax(stdSymbol: string, price: number) {
    return this.stdExchange.exchangeSpot.spotGetTradeMinMax(stdSymbol, price);
  }

  public async spotGetTradeMinNotional(stdSymbol: string): Promise<number> {
    return this.stdExchange.exchangeSpot.spotGetTradeMinNotional(stdSymbol);
  }

  public async spotSell(orderId: string, stdSymbol: string, amount: string | undefined, qty: string | undefined) {
    return this.stdExchange.exchangeSpot.createMarketOrder(
      orderId,
      stdSymbol,
      (() => {
        if (amount) {
          return new BigNumber(`${amount}`);
        }
        return undefined;
      })(),
      (() => {
        if (qty) {
          return new BigNumber(`${qty}`);
        }
        return undefined;
      })(),
      ISide.SELL
    );
  }
}

export { StdOrder };
