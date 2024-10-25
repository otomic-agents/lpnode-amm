import { AmmContext } from "../../interface/context";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";

class AmmContextManager {
  public async appendContext(orderId: number, key: string, value: any) {
    const setObj :any= {};
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
      logger.error(`can't handle ammContext appendContext`);
      logger.error(e);
    }
  }
  public async set(orderId: number, data: any) {
    try {
      await ammContextModule.findOneAndUpdate(
        {
          "systemOrder.orderId": orderId,
        },
        {
          $set: data,
        }
      );
    } catch (e) {
      logger.error(`can't handle ammContext appendContext`);
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
  public async getContextByBusinessHash(hash: string) {
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "businessHash": hash,
      })
      .lean();
    return ammContext;
  }
}

const ammContextManager: AmmContextManager = new AmmContextManager();
export { ammContextManager };
