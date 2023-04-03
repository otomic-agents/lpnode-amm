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
  public async spotBuy(orderId: string, stdSymbol: string, amount: string) {
    logger.debug(`spotBuy`, stdSymbol);
    return this.stdExchange.exchangeSpot.createMarketOrder(
      orderId,
      stdSymbol,
      new BigNumber(`${amount}`),
      ISide.BUY
    );
  }
  public async spotSell(orderId: string, stdSymbol: string, amount: string) {
    return this.stdExchange.exchangeSpot.createMarketOrder(
      orderId,
      stdSymbol,
      new BigNumber(`${amount}`),
      ISide.SELL
    );
  }
}

export { StdOrder };
