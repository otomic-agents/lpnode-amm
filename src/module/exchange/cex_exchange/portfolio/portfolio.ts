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
import { ISpotOrderResult } from "../../../../interface/std_difi";
import { logger } from "../../../../sys_lib/logger";
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
      logger.debug(data);
      const action = _.get(data, "action", "unknow");
      const market = _.get(data, "payload.market", "");
      const rawInfo = _.get(data, "payload.rawInfo", {});
      if (action === "order_result" && market === "spot" && rawInfo) {
        this.onSportOrder(rawInfo);
      }
      // this.emit(_.get(data, "action", "unknow"), data);
    });
  }
  public onSportOrder(rawInfo: any) {
    this.emit(
      "spot_order_close",
      ((): ISpotOrderResult => {
        if (typeof this.exchangeSpot.formatOrder === "function") {
          return this.exchangeSpot.formatOrder(rawInfo);
        }
        throw new Error("Convert order format is not supported");
      })()
    );
  }
  /**
   *
   * {
          action: "order_result",
          payload: {
            market: "spot",
            rawInfo: _.get(method, "params", {}),
          },
        }
   */
}
export { PortfolioExchange };
