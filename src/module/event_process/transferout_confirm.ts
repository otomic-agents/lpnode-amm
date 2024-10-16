import { dataConfig } from "../../data_config";
import { AmmContext } from "../../interface/context";
import { IEVENT_TRANSFER_OUT_CONFIRM } from "../../interface/event";
import {
  EFlowStatus,
  IHedgeType,
  ILpCmd,
  ISpotHedgeInfo,
} from "../../interface/interface";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import { getNumberFrom16 } from "../../utils/ethjs_unit";
import { hedgeManager } from "../hedge_manager";
import { BaseEventProcess } from "./base_event_process";
import * as _ from "lodash";
import { ammContextManager } from "../amm_context_manager/amm_context_manager";
import { EthUnit } from "../../utils/eth";

class EventProcessTransferOutConfirm extends BaseEventProcess {
  public async process(msg: IEVENT_TRANSFER_OUT_CONFIRM) {
    const orderId = this.getLpOrderId(msg);
    if (!orderId) {
      throw new Error(`The orderid was not found`);
    }
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "systemOrder.orderId": orderId,
      })
      .lean();
    if (!ammContext) {
      throw new Error("No order information found");
    }
    if (_.get(ammContext, "systemOrder.cexResult", undefined)) {
      throw new Error("Confirm cannot be repeated");
    }
    ammContext.bridgeItem = dataConfig.findItemByMsmqPath(
      ammContext.systemInfo.msmqName
    );
    await this.setChainOptInfoData(ammContext, msg);

    if (ammContext.hedgeEnabled) {
      await ammContextManager.appendContext(
        orderId,
        "flowStatus",
        EFlowStatus.WaitHedge
      );
      await ammContextManager.appendContext(
        orderId,
        "dexTradeInfo_out_confirm",
        _.get(msg, "business_full_data.event_transfer_out_confirm")
      )
      await this.processHedge(msg, ammContext);
    } else {
      // mark no hedging required
      await ammContextManager.set(orderId, {
        flowStatus: EFlowStatus.NoHedge,
        transferoutConfirmTime: new Date().getTime(),
      });
    }

    const responseMsg = {
      cmd: ILpCmd.CMD_TRANSFER_IN_CONFIRM,
      business_full_data: _.get(msg, "business_full_data"),
    };
    await this.responseMessage(responseMsg, ammContext.systemInfo.msmqName);
  }

  private async setChainOptInfoData(
    ammContext: AmmContext,
    msg: IEVENT_TRANSFER_OUT_CONFIRM
  ) {
    ammContext = await this.setSrcChainOptInfo(ammContext); // set src data info

    const dstChainPayAmountRaw = _.get(
      msg,
      "business_full_data.event_transfer_in.token_amount",
      ""
    );
    const dstChainPayAmountNumber = getNumberFrom16(
      dstChainPayAmountRaw,
      ammContext.baseInfo.dstToken.precision
    );
    ammContext.chainOptInfo.dstChainPayAmount = dstChainPayAmountRaw;
    ammContext.chainOptInfo.dstChainPayAmountNumber = dstChainPayAmountNumber;

    const dstChainPayNativeTokenAmountRaw = _.get(
      msg,
      "business_full_data.event_transfer_in.eth_amount",
      ""
    );
    const dstChainPayNativeTokenAmountNumber = getNumberFrom16(
      dstChainPayNativeTokenAmountRaw,
      ammContext.baseInfo.dstChain.nativeTokenPrecision
    );

    ammContext.chainOptInfo.dstChainPayNativeTokenAmount =
      dstChainPayNativeTokenAmountRaw;
    ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber =
      dstChainPayNativeTokenAmountNumber;
    await ammContextManager.appendContext(
      ammContext.systemOrder.orderId,
      "chainOptInfo",
      ammContext.chainOptInfo
    );
    logger.info(`debug line`);
  }

  private async setSrcChainOptInfo(
    ammContext: AmmContext
  ): Promise<AmmContext> {
    const receive = await ammContext.bridgeItem.lp_wallet_info.getReceivePrice(
      ammContext
    );
    const receiveStr = EthUnit.toWei(
      receive.toString(),
      ammContext.baseInfo.srcToken.precision
    );
    ammContext.chainOptInfo.srcChainReceiveAmount = receiveStr;
    ammContext.chainOptInfo.srcChainReceiveAmountNumber = receive;
    return ammContext;
  }

  private async processHedge(
    msg: IEVENT_TRANSFER_OUT_CONFIRM,
    ammContext: AmmContext
  ) {
    if (ammContext.bridgeItem.hedge_info.getHedgeType() === IHedgeType.Null) {
      return true;
    }
    const hedgeType = ammContext.bridgeItem.hedge_info.getHedgeType();

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
