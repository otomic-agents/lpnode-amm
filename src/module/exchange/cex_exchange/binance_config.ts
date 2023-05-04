import * as _ from "lodash";
class BinanceConfig {
  private baseApi: {
    spot: string;
    usdtFuture: string;
    coinFuture: string;
  };
  public constructor() {
    const envStr = _.get(process.env, "NODE_ENV", "dev");
    if (envStr === "production" || envStr === "prod") {
      this.baseApi = {
        spot: "https://testnet.binance.vision",
        usdtFuture: "https://fapi.binance.com",
        coinFuture: "https://dapi.binance.com",
      };
    } else {
      this.baseApi = {
        spot: "https://testnet.binance.vision",
        usdtFuture: "https://fapi.binance.com",
        coinFuture: "https://testnet.binancefuture.com",
      };
    }
  }

  public getSpotBaseApi() {
    return this.baseApi.spot;
  }
  public getUsdtFutureBaseApi() {
    return this.baseApi.usdtFuture;
  }
  public getCoinFutureBaseApi() {
    return this.baseApi.coinFuture;
  }
}
const binanceConfig: BinanceConfig = new BinanceConfig();
export { binanceConfig };
