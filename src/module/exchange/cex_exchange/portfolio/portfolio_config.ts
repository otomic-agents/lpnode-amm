import { logger } from "../../../../sys_lib/logger";

class PortfolioConfig {
  public apiBaseUrl = "https://portfolio.a07405.snowinning.com";
  public getBaseApi(type: string): string {
    if (type === "markets") {
      return "https://cex-api.bttcdn.com/trade/getMarketInfo";
    }
    if (type === "createOrder") {
      return "https://cex-api.bttcdn.com/trade/createOrder";
    }
    if (type === "spotBalance") {
      return `${this.apiBaseUrl}/trade/getAccount`;
    }
    if (type === "getDepth") {
      return "https://cex-api.bttcdn.com/trade/getDepth";
    }
    if (type === "addSubMarkets") {
      return "https://cex-api.bttcdn.com/trade/addSubMarkets";
    }
    if (type === "wsOrderStream") {
      return "wss://data-collect-dev-ws.bttcdn.com/ws/";
    }
    logger.error(`unknow type`, type);
    return "";
  }

}

const portfolioConfig: PortfolioConfig = new PortfolioConfig();
export { portfolioConfig };
