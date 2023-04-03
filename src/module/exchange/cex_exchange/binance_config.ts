import * as _ from "lodash";
class BinanceConfig {
  public constructor() {
    const testVal = _.get(
      process.env,
      "KUBERNETES_SERVICE_PORT_HTTPS",
      undefined
    );
    if (!testVal) {
      // 测试环境
      this.baseApi = {
        spot: "https://testnet.binance.vision",
        usdtFuture: "https://testnet.binancefuture.com",
        coinFuture: "https://testnet.binancefuture.com",
      };
      return;
    }
    this.baseApi = {
      spot: "https://testnet.binance.vision",
      usdtFuture: "https://testnet.binancefuture.com",
      coinFuture: "https://testnet.binancefuture.com",
    };
  }
  private baseApi: {
    spot: "https://testnet.binance.vision";
    usdtFuture: "https://testnet.binancefuture.com";
    coinFuture: "https://testnet.binancefuture.com";
  };
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
