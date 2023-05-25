import {
  IStdExchange,
  IStdExchangeCoinFuture,
  IStdExchangeSpot,
  IStdExchangeUsdtFuture,
} from "../../../../interface/std_exchange";
import { PortfolioSpot } from "./portfolio_spot";
import { PortfolioUsdtFuture } from "./portfolio_usdt_future";
import { PortfolioPrivateStream } from "./portfolio_private_stream";
import { PortfolioCoinFuture } from "./portfolio_coin_future";
import * as _ from "lodash";
const Emittery = require("emittery");
class PortfolioExchange extends Emittery implements IStdExchange {
  public exchangeSpot: IStdExchangeSpot;
  public exchangeUsdtFuture: IStdExchangeUsdtFuture;
  public exchangeCoinFuture: IStdExchangeCoinFuture;
  public exchangePrivateStream: PortfolioPrivateStream;
  public exchangeName = "binance";
  private accountId: string;

  public constructor(accountId: string) {
    super();
    this.accountId = accountId;
    this.exchangeSpot = new PortfolioSpot(this.accountId);
    this.exchangeUsdtFuture = new PortfolioUsdtFuture(this.accountId);
    this.exchangeCoinFuture = new PortfolioCoinFuture(this.accountId);
    this.exchangePrivateStream = new PortfolioPrivateStream(this.accountId);
    this.exchangePrivateStream.on("streamEvent", (data) => {
      this.emit(_.get(data, "action", "unknow"), data);
    });
  }
}
export { PortfolioExchange };
