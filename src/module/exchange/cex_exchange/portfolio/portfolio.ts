import {
  IStdExchange,
  IStdExchangeCoinFuture,
  IStdExchangeSpot,
  IStdExchangeUsdtFuture,
} from "../../../../interface/std_exchange";
import { PortfolioSpot } from "./portfolio_spot";
import { PortfolioUsdtFuture } from "./portfolio_usdt_future";
import { PortfolioCoinFuture } from "./profolio_coin_future";

class PortfolioExchange implements IStdExchange {
  public exchangeSpot: IStdExchangeSpot;
  public exchangeUsdtFuture: IStdExchangeUsdtFuture;
  public exchangeCoinFuture: IStdExchangeCoinFuture;
  public exchangeName = "binance";
  private accountId: string;

  public constructor(accountId: string) {
    this.accountId = accountId;
    this.exchangeSpot = new PortfolioSpot(this.accountId);
    this.exchangeUsdtFuture = new PortfolioUsdtFuture(this.accountId);
    this.exchangeCoinFuture = new PortfolioCoinFuture(this.accountId);
  }
}
export { PortfolioExchange };
