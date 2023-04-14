import { ammContextModule } from "../mongo_module/amm_context";
import { logger } from "../sys_lib/logger";
import { AmmContext } from "../interface/context";

class Profit {
  public process() {
    this.scanContext();
  }

  private async scanContext() {
    try {
      const ammContext: AmmContext = await ammContextModule.findOne({}).lean();
      if (!ammContext) {
        //
      }
      await this.processItem(ammContext);
    } catch (e) {
      logger.error(e);
    }
  }

  private async processItem(ammContext: AmmContext) {
    logger.debug(ammContext);
  }
}

const profit: Profit = new Profit();
export {
  Profit,
  profit
};
