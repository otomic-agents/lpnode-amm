import { IStdExchangeCoinFuture } from "../../../../interface/std_exchange";
import { logger } from "../../../../sys_lib/logger";
import {
  ICoinFutureBalanceItem,
  ICoinFutureSymbolItem,
} from "../../../../interface/std_difi";
class AdapterCoinFuture implements IStdExchangeCoinFuture {
  // @ts-ignore
  private accountId: string;
  public constructor(accountId: string) {
    this.accountId = accountId;
  }
  public async loadMarkets() {
    logger.debug(`init markets`);
  }
  public fetchMarkets(): Map<string, ICoinFutureSymbolItem> {
    const c: any = "";
    return c;
    //
  }
  public async fetchBalance(): Promise<void> {
    //
  }
  public getBalance(): Map<string, ICoinFutureBalanceItem> {
    const c: any = new Map();
    return c;
  }
}
export { AdapterCoinFuture };
