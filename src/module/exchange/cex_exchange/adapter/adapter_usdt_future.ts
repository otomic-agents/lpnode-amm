import { IStdExchangeUsdtFuture } from "../../../../interface/std_exchange";
import * as _ from "lodash";
import {
  ISide,
  IUsdtFutureSymbolItem,
  IUsdtFutureAccountPositionsRiskItem,
} from "../../../../interface/std_difi";
import BigNumber from "bignumber.js";

import { ISpotSymbolItemAdapter } from "../../../../interface/cex_adapter";
import { logger } from "../../../../sys_lib/logger";
class AdapterUsdtFuture implements IStdExchangeUsdtFuture {
  // @ts-ignore
  private accountId: string;
  protected spotSymbolsInfoByMarketName: Map<string, ISpotSymbolItemAdapter> =
    new Map();
  protected spotSymbolsInfo: Map<string, ISpotSymbolItemAdapter> = new Map();
  public constructor(accountId: string) {
    this.accountId = accountId;
  }
  public async loadMarkets(): Promise<void> {
    logger.info("AdapterUsdtFuture_loadMarkets")
  }
  public fetchMarkets(): Map<string, IUsdtFutureSymbolItem> {
    const c: any = "";
    return c;
  }
  public async fetchOrdersBySymbol(symbol: string): Promise<any> {
    return "";
  }
  public async loadBalance(): Promise<void> {
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
  public getBalance(): Map<string, any> {
    const a: any = new Map();
    return a;
  }
}
export { AdapterUsdtFuture };
