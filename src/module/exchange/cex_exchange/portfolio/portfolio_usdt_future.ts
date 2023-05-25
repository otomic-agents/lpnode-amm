import { IStdExchangeUsdtFuture } from "../../../../interface/std_exchange";
import { logger } from "../../../../sys_lib/logger";
import {
  ISide,
  IUsdtFutureSymbolItem,
  IUsdtFutureAccountPositionsRiskItem,
} from "../../../../interface/std_difi";
import BigNumber from "bignumber.js";
import { IUsdtFutureBalanceItemPortfolio } from "../../../../interface/cex_portfolio";
class PortfolioUsdtFuture implements IStdExchangeUsdtFuture {
  // @ts-ignore
  private accountId: string;
  public constructor(accountId: string) {
    this.accountId = accountId;
  }
  public async initMarkets(): Promise<void> {
    //
    logger.info(`PortfolioUsdtFuture`);
  }
  public async fetchOrdersBySymbol(symbol: string): Promise<any> {
    return "";
  }
  public fetchMarkets(): Map<string, IUsdtFutureSymbolItem> {
    const c: any = "";
    return c;
  }

  public async fetchBalance(): Promise<void> {
    //
  }
  public async fetchPositionRisk() {
    //
  }
  public getPositionRisk(): Map<string, IUsdtFutureAccountPositionsRiskItem> {
    const c: any = "";
    return c;
  }
  public async createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber,
    side: ISide
  ): Promise<any> {
    throw new Error(`not yet implemented`);
  }
  public getBalance(): Map<string, IUsdtFutureBalanceItemPortfolio> {
    const a: any = new Map();
    return a;
  }
}
export { PortfolioUsdtFuture };
