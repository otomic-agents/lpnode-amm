import * as _ from "lodash";
import { IStdExchange } from "../../interface/std_exchange";
import { IOrderExecModel, ISide } from "../../interface/std_difi";
import BigNumber from "bignumber.js";
import { logger } from "../../sys_lib/logger";
import { StdOrderBase } from "./std_order_base";

class StdOrder extends StdOrderBase {
  private stdExchange: IStdExchange;

  public constructor(cexExchange: IStdExchange) {
    super();
    this.stdExchange = cexExchange;
  }
  public getSpotExecModel(): IOrderExecModel {
    return this.stdExchange.exchangeSpot.getExecModel();
  }
  public async spotBuy(
    orderId: string,
    stdSymbol: string,
    amount: string | undefined,
    qty: string | undefined,
    targetPrice: string | undefined,
    simulation = false
  ) {
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
      ISide.BUY,
      (() => {
        if (!targetPrice) {
          return new BigNumber(0);
        }
        return new BigNumber(targetPrice);
      })(),
      simulation
    );
  }
  public async spotSell(
    orderId: string,
    stdSymbol: string,
    amount: string | undefined,
    qty: string | undefined,
    targetPrice: string | undefined,
    simulation = false
  ) {
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
      ISide.SELL,
      (() => {
        if (!targetPrice) {
          return new BigNumber(0);
        }
        return new BigNumber(targetPrice);
      })(),
      simulation
    );
  }
  public async spotTradeCheck(
    stdSymbol: string,
    value: number,
    amount: number
  ): Promise<boolean> {
    if (!_.isFinite(value)) {
      logger.error(`输入的量有问题.`, value);
      return false;
    }
    return this.stdExchange.exchangeSpot.spotTradeCheck(
      stdSymbol,
      value,
      amount
    );
  }

  public async swapBuy(stdSymbol: string, amount: BigNumber) {
    return this.stdExchange.exchangeUsdtFuture.createMarketOrder(
      "001",
      stdSymbol,
      amount,
      ISide.SELL
    );
    //
  }

  public async testSpotFormat(input: any) {
    if (this.stdExchange.exchangeSpot.formatSpotOrder) {
      return this.stdExchange.exchangeSpot.formatSpotOrder(input);
    }
    logger.debug(`format method not found`);
    return undefined;
  }
  public async getUsdtFutureOrdersBySymbol(symbol: string) {
    return this.stdExchange.exchangeUsdtFuture.fetchOrdersBySymbol(symbol);
  }

  // public async swapSell(){
  // }
  public async getSpotTradeMinMax(stdSymbol: string, price: number) {
    return this.stdExchange.exchangeSpot.spotGetTradeMinMax(stdSymbol, price);
  }

  public async getSpotTradeMinMaxValue(stdSymbol: string) {
    return this.stdExchange.exchangeSpot.spotGetTradeMinMaxValue(stdSymbol);
  }

  public async spotGetTradeMinNotional(stdSymbol: string): Promise<number> {
    return this.stdExchange.exchangeSpot.spotGetTradeMinNotional(stdSymbol);
  }
}

export { StdOrder };
