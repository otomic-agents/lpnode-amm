import { dataConfig } from "../data_config";
import { IHedgeClass, IHedgeType } from "../interface/interface";
import { logger } from "../sys_lib/logger";
import { coinSpotHedge } from "./hedge/coin_spot_hedge";
import * as _ from "lodash";

class HedgeManager {
  public async init() {
    try {
      const hedgeConfig = await dataConfig.getHedgeConfig();
      console.log("\n");
      console.log("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥");
      console.log("🔥                        HEDGE CONFIGURATION                        🔥");
      console.log("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥");
      console.log(JSON.stringify(hedgeConfig, null, 2));
      console.log("🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥");
      console.log("\n");
      // Check if hedging is needed based on hedge type
      if (await hedgeConfig.hedgeType === IHedgeType.Null) {
        logger.info(`Hedging disabled: Hedge type is Null`);
        return;
      }
      
      logger.info(`Initializing HedgeManager with type: ${hedgeConfig.hedgeType}`);
      
      // Initialize spot hedge
      await coinSpotHedge.init();
      logger.info("Spot hedge initialization completed successfully");
      
    } catch (e:any) {
      console.log(e)
      logger.error(`HedgeManager initialization failed: ${e.message}`, {
        error: e,
        stack: e.stack
      });
    }
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
