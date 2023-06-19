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
import { PortfolioAuthManager } from "./portfolio_auth_manager";
const Emittery = require("emittery");
class PortfolioExchange extends Emittery implements IStdExchange {
  public exchangeSpot: IStdExchangeSpot;
  public exchangeUsdtFuture: IStdExchangeUsdtFuture;
  public exchangeCoinFuture: IStdExchangeCoinFuture;
  public exchangePrivateStream: PortfolioPrivateStream;
  public authManager: PortfolioAuthManager;
  public exchangeName = "binance";
  private accountId: string;

  public constructor(accountId: string, userInfo: any) {
    super();
    this.accountId = accountId;
    this.exchangeSpot = new PortfolioSpot(this.accountId);
    this.exchangeSpot.exchangeName = this.exchangeName;
    this.exchangeUsdtFuture = new PortfolioUsdtFuture(this.accountId);
    this.exchangeCoinFuture = new PortfolioCoinFuture(this.accountId);
    this.authManager = new PortfolioAuthManager(this.accountId, userInfo);
    const enableWs = _.get(userInfo, "enablePrivateStream", false);
    logger.debug("enableWs config", enableWs, JSON.stringify(userInfo));
    if (enableWs) {
      this.exchangePrivateStream = new PortfolioPrivateStream(
        this.accountId // test account
      );
      logger.debug("login to ws:", this.accountId);
      this.exchangePrivateStream.on("streamEvent", (data) => {
        logger.debug(data);
        const action = _.get(data, "action", "unknow");
        const market = _.get(data, "payload.market", "");
        const rawInfo = _.get(data, "payload.rawInfo", {});
        if (action === "order_result" && market === "spot" && rawInfo) {
          this.onSportOrder(rawInfo);
        }
      });
      this.exchangePrivateStream.connect();
    }
  }
  public onSportOrder(rawInfo: any) {
    const eventStatus = _.get(rawInfo, "orderEventStatus", undefined);
    if (eventStatus === "ORDER_DONE") {
      this.emit(
        "spot_order_close",
        ((): ISpotOrderResult | undefined => {
          if (typeof this.exchangeSpot.formatOrder === "function") {
            return this.exchangeSpot.formatOrder(rawInfo);
          }
          throw new Error("convert order format is not supported");
        })()
      );
    }
    if (eventStatus === "ORDER_CREATE_REJECTED") {
      this.emit(
        "spot_order_create_rejected",
        _.get(rawInfo, "client_id", undefined),
        rawInfo
      );
    }
  }
}
export { PortfolioExchange };
