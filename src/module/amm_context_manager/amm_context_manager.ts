import { AmmContext } from "../../interface/context";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";

class AmmContextManager {
  public async appendContext(orderId: number, key: string, value: any) {
    const setObj = {};
    setObj[key] = value;
    try {
      await ammContextModule.findOneAndUpdate(
        {
          "systemOrder.orderId": orderId,
        },
        {
          $set: setObj,
        }
      );
    } catch (e) {
      logger.error(`无法处理 ammContext appendContext`);
      logger.error(e);
    }
  }
  public async getContextByQuoteHash(hash: string) {
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "quoteInfo.quote_hash": hash,
      })
      .lean();
    return ammContext;
  }
}

const ammContextManager: AmmContextManager = new AmmContextManager();
export { ammContextManager };
