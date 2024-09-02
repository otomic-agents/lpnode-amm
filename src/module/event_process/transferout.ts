import { AmmContext } from "../../interface/context";
import { IEVENT_TRANSFER_OUT } from "../../interface/event";
import { EFlowStatus, ILpCmd } from "../../interface/interface";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import { BaseEventProcess } from "./base_event_process";

import * as _ from "lodash";

class EventProcessTransferOut extends BaseEventProcess {
  /**
   * ProcessTransferOut
   * @date 2/2/2023 - 11:17:44 AM
   *
   * @public
   * @async
   * @param {IEVENT_TRANSFER_OUT} msg "TransferOut Event Data"
   * @returns {Promise<void>} ""
   */
  public async process(msg: IEVENT_TRANSFER_OUT): Promise<void> {
    let ammContext: AmmContext;
    try {
      logger.debug(`🏠🏠🏠🏠🏠:process event  【IEVENT_TRANSFER_OUT】symbol `);
      
      const  verified =  this.checkTransferOut(msg)
      if (!verified){
        throw new Error(`checkTransferOut Failed`);
      }
      const orderId = await this.verificationBaseParameters(msg);
      ammContext = await ammContextModule
        .findOne({
          "systemOrder.orderId": orderId,
        })
        .lean();
      


      // logger.debug(ammContext)
      if (!ammContext) {
        throw new Error(`No order found`);
      }
      
      await this.verificationTime(msg);
      
      // await ammContextManager.appendContext(orderId, 'flowStatus', EFlowStatus.TransferOut)
      await this.updateOrderInfo(ammContext, orderId, msg);
    } catch (e) {
      logger.error(e);
      return;
    }
    const responseMsg = {
      cmd: ILpCmd.CMD_TRANSFER_IN,
      business_full_data: _.get(msg, "business_full_data"),
    };
    await this.responseMessage(responseMsg, ammContext.systemInfo.msmqName);
  }
  private checkTransferOut(msg:IEVENT_TRANSFER_OUT): boolean {
    console.log(JSON.stringify(msg))
    const preAmount = _.get(msg, "business_full_data.pre_business.swap_asset_information.amount", null)
    const afterAmount = _.get(msg, "business_full_data.event_transfer_out.amount", null)
    const preLpAddress = _.get(msg, "business_full_data.pre_business.swap_asset_information.quote.quote_base.lp_bridge_address", null)
    const afterLpAddress = _.get(msg, "business_full_data.event_transfer_out.receiver", null)
    const preTime = _.get(msg, "business_full_data.pre_business.swap_asset_information.agreement_reached_time", null)
    const afterTime = _.get(msg, "business_full_data.event_transfer_out.agreement_reached_time", null)
    const preToken = _.get(msg, "business_full_data.pre_business.swap_asset_information.quote.quote_base.bridge.src_token", null)
    const afterToken = _.get(msg, "business_full_data.event_transfer_out.token", null)
    const values = {
      preAmount,
      afterAmount,
      preLpAddress,
      afterLpAddress,
      preTime,
      afterTime,
      preToken,
      afterToken
    }
    let allNonNull = true;
    for (const key in values) {
      if (values[key] === null) {
        logger.error(`${key} is empty`)
        allNonNull = false;
        break;
      }
    }
    if (!allNonNull) {
      return false
    }
    if (!(preAmount === afterAmount)) {
      logger.info("amount diff", preAmount, afterAmount)
      logger.error(new Error("amount error"))
      return false
    }
    if (!(preLpAddress === afterLpAddress)) {
      logger.info("LpAddress diff", preLpAddress, afterLpAddress)
      logger.error(new Error("afterLpAddress error"))
      return false
    }

    // logger.debug(msg.business_full_data.pre_business.swap_asset_information.amount);
    // logger.debug(msg.business_full_data.event_transfer_out.amount)
    // sender
    // receiver
    return true
  }

  private async updateOrderInfo(
    ammContext: AmmContext,
    orderId: number,
    msg: IEVENT_TRANSFER_OUT
  ) {
    if (_.get(ammContext, "systemOrder.transferOutInfo", undefined)) {
      throw new Error(`You cannot roll out repeatedly`);
    }
    const doc = await ammContextModule
      .findOneAndUpdate(
        { "systemOrder.orderId": orderId },
        {
          $set: {
            flowStatus: EFlowStatus.TransferOut,
            "systemOrder.transferOutInfo": {
              amount: _.get(
                msg,
                "business_full_data.event_transfer_out.amount",
                ""
              ),
            },
            "systemOrder.transferOutTimestamp": new Date().getTime(),
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
    logger.info(
      `modify information`,
      _.get(doc, "systemOrder.transferOutInfo", {})
    );
  }

  private verificationBaseParameters(msg: IEVENT_TRANSFER_OUT): number {
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

    private async verificationTime(msg: IEVENT_TRANSFER_OUT) {
    // const lockQuoteTimestamp = Number(
      //   _.get(
        //     msg,
        //     "business_full_data.pre_business.swap_asset_information.time_lock",
        //     0
    //   )
    // );
    // if (!_.isFinite(lockQuoteTimestamp) || lockQuoteTimestamp === 0) {
      //   logger.debug(`lockQuoteTimestamp incorrect`);
      //   throw new Error(`lockQuoteTimestamp incorrect ${lockQuoteTimestamp}`);
    // }
    // const eventDelay = new Date().getTime() - lockQuoteTimestamp * 1000;
    // if (eventDelay > 1000 * 60 * 5) {
      //   logger.error(`the time to lock in the price is too long :${eventDelay}`);
      //   throw new Error(
        //     `the time to lock in the price is too long :${eventDelay}`
      //   );
    // }
  }
}

const eventProcessTransferOut: EventProcessTransferOut =
  new EventProcessTransferOut();
export { eventProcessTransferOut };
