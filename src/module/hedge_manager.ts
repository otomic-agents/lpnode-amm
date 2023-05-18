import { IHedgeClass, IHedgeType } from "../interface/interface";
import { logger } from "../sys_lib/logger";
import { coinSpotHedge } from "./hedge/coin_spot_hedge";

class HedgeManager {
  public async init() {
    await coinSpotHedge.init();
    logger.debug(`init HedgeManager`);
  }

  public getHedgeIns(hedgeType: IHedgeType): IHedgeClass {
    if (hedgeType === IHedgeType.CoinSpotHedge) {
      return coinSpotHedge;
    }
    throw new Error(
      `No corresponding hedging implementation found:${hedgeType}`
    );
  }
}

const hedgeManager: HedgeManager = new HedgeManager();
export { HedgeManager, hedgeManager };
