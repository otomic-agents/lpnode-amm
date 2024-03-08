import { dataConfig } from "../data_config";
import { IHedgeClass, IHedgeType } from "../interface/interface";
import { logger } from "../sys_lib/logger";
import { coinSpotHedge } from "./hedge/coin_spot_hedge";
import * as _ from "lodash";

class HedgeManager {
  public async init() {
    if (dataConfig.getHedgeConfig().hedgeType === IHedgeType.Null) {
      logger.info(`No need for hedging.`);
      return;
    }
    const enabledHedge = _.get(dataConfig.getBridgeBaseConfig(), "enabledHedge", "false");
    if (!enabledHedge || enabledHedge === "false") {
      logger.warn("No need for hedging.");
      return;
    }
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
