import { AmmContext } from "../../interface/context";
import { IEVENT_TRANSFER_IN } from "../../interface/event";
import { EFlowStatus } from "../../interface/interface";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import { chainBalance } from "../chain_balance";
import { chainBalanceLock } from "../chain_balance_lock";
import { BaseEventProcess } from "./base_event_process";
import * as _ from "lodash";
class EventProcessTransferIn extends BaseEventProcess {
  public async process(msg: IEVENT_TRANSFER_IN): Promise<void> {
    let ammContext: AmmContext;

    const orderId = await this.verificationBaseParameters(msg);
    ammContext = await ammContextModule
      .findOne({
        "systemOrder.orderId": orderId,
      })
      .lean();
    if (!ammContext) {
      throw new Error(`No order found`);
    }
    await chainBalanceLock.freeBalance(ammContext.quoteInfo.quote_hash);
    logger.info(
      "free balance ok",
      "🐳🐳🐳🐳🐳",
      ammContext.quoteInfo.quote_hash
    );
    const doc = await ammContextModule
      .findOneAndUpdate(
        { "systemOrder.orderId": orderId },
        {
          $set: {
            flowStatus: EFlowStatus.TransferIn,
            dexTradeInfo_in: {
              rawData: _.get(msg, "business_full_data.event_transfer_in", {}),
            },
            "systemOrder.transferInTimestamp": new Date().getTime(),
          },
        },
        {
          returnDocument: "after",
        }
      )
      .lean();
    if (!doc) {
      throw new Error(`No documentation was found that should be updated`);
    }
  }
  private verificationBaseParameters(msg: IEVENT_TRANSFER_IN): number {
    const orderInfo = _.get(
      msg,
      "business_full_data.pre_business.order_append_data",
      "{}"
    );
    if (!orderInfo) {
      throw new Error("can't find orderId...");
    }
    const orderId = _.get(JSON.parse(orderInfo), "orderId", undefined);
    if (!orderId || !_.isFinite(orderId)) {
      throw new Error("parsing failed");
    }
    return orderId;
  }
}
const eventProcessTransferIn: EventProcessTransferIn =
  new EventProcessTransferIn();
export { eventProcessTransferIn };
