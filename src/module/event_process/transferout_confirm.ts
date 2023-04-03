import { dataConfig } from "../../data_config";
import { AmmContext } from "../../interface/context";
import { IEVENT_TRANSFER_OUT_CONFIRM } from "../../interface/event";
import { IHedgeType, ILpCmd, ISpotHedgeInfo } from "../../interface/interface";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import { getNumberFrom16 } from "../../utils/ethjs_unit";
import { hedgeManager } from "../hedge_manager";
import { BaseEventProcess } from "./base_event_process";
import * as _ from "lodash";
class EventProcessTransferOutConfirm extends BaseEventProcess {
  public async process(msg: IEVENT_TRANSFER_OUT_CONFIRM) {
    const ammContext: AmmContext = await ammContextModule
        .findOne({
          "systemOrder.orderId": this.getLpOrderId(msg),
        })
        .lean();
    if (!ammContext) {
      throw new Error("No order information found");
    }
    if (_.get(ammContext, "systemOrder.cexResult", undefined)) {
      throw new Error("Confirm cannot be repeated");
    }

    const hedgeType = dataConfig.getHedgeConfig().hedgeType;
    logger.debug(`hedgeType:${hedgeType}`);
    if (hedgeType !== IHedgeType.Null) {
      await this.processHedge(msg, ammContext);
    }

    const responseMsg = {
      cmd: ILpCmd.CMD_TRANSFER_IN_CONFIRM,
      business_full_data: _.get(msg, "business_full_data"),
    };
    await this.responseMessage(responseMsg, ammContext.systemInfo.msmqName);
  }
  private async processHedge(
      msg: IEVENT_TRANSFER_OUT_CONFIRM,
      ammContext: AmmContext
  ) {
    if (dataConfig.getHedgeConfig().hedgeType === IHedgeType.Null) {
      return true;
    }
    const hedgeType = dataConfig.getHedgeConfig().hedgeType;

    const sourceCountEtherString = _.get(
        msg,
        "business_full_data.event_transfer_out.amount",
        "0"
    );
    const targetCountEtherString = _.get(
        msg,
        "business_full_data.event_transfer_out.dst_amount",
        "0"
    );
    if (sourceCountEtherString === "0" || targetCountEtherString === "0") {
      throw new Error(
          `Unexpected transfers in or out ${sourceCountEtherString} ${targetCountEtherString}`
      );
    }
    const orderId: number = this.getLpOrderId(msg);
    if (orderId === 0) {
      logger.error(`Unable to find orderId`);
      return;
    }
    const hedgeInfo: ISpotHedgeInfo = {
      orderId: this.getLpOrderId(msg),
      ammContext,
    };
    hedgeInfo.ammContext.swapInfo.srcAmountNumber = getNumberFrom16(
        sourceCountEtherString,
        hedgeInfo.ammContext.baseInfo.srcToken.precision
    );
    hedgeInfo.ammContext.swapInfo.dstAmountNumber = getNumberFrom16(
        targetCountEtherString,
        hedgeInfo.ammContext.baseInfo.dstToken.precision
    );
    await ammContextModule.findOneAndUpdate(
        {
          "systemOrder.orderId": _.get(ammContext, "systemOrder.orderId", 0),
        },
        {
          $set: {
            "swapInfo.srcAmount": sourceCountEtherString,
            "swapInfo.srcAmountNumber":
            hedgeInfo.ammContext.swapInfo.srcAmountNumber,
            "swapInfo.dstAmount": targetCountEtherString,
            "swapInfo.dstAmountNumber":
            hedgeInfo.ammContext.swapInfo.dstAmountNumber,
          },
        }
    );
    await hedgeManager.getHedgeIns(hedgeType).hedge(hedgeInfo);
  }
  private getLpOrderId(msg: IEVENT_TRANSFER_OUT_CONFIRM): number {
    const orderInfo = _.get(
        msg,
        "business_full_data.pre_business.order_append_data",
        "{}"
    );
    if (!orderInfo) {
      logger.error("order information could not be found...");
      return 0;
    }
    const orderId = _.get(JSON.parse(orderInfo), "orderId", undefined);
    if (!orderId || !_.isFinite(orderId)) {
      logger.error("orderId parsing failed...");
      return 0;
    }
    return orderId;
  }
}
const eventProcessTransferOutConfirm: EventProcessTransferOutConfirm =
    new EventProcessTransferOutConfirm();
export { eventProcessTransferOutConfirm };
