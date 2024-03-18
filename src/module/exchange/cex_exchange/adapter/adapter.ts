import {
  IStdExchange,
  IStdExchangeCoinFuture,
  IStdExchangeSpot,
  IStdExchangeUsdtFuture,
} from "../../../../interface/std_exchange";
import { AdapterCoinFuture } from "./adapter_coin_future";
import { AdapterSpot } from "./adapter_spot";
import { AdapterUsdtFuture } from "./adapter_usdt_future";
const Emittery = require("emittery");
class AdapterExchange extends Emittery implements IStdExchange {
  public exchangeSpot: IStdExchangeSpot;
  public exchangeUsdtFuture: IStdExchangeUsdtFuture;
  public exchangeCoinFuture: IStdExchangeCoinFuture;

  public exchangeName = "adapter";
  private accountId: string;
  public constructor(accountId: string, userInfo: any) {
    super();
    this.accountId = accountId;
    this.exchangeSpot = new AdapterSpot(this.accountId);
    this.exchangeCoinFuture = new AdapterCoinFuture(this.accountId);
    this.exchangeUsdtFuture = new AdapterUsdtFuture(this.accountId);
  }
}
export { AdapterExchange };
