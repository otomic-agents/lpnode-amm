import { AmmContext } from "../../interface/context";
import { IEVENT_TRANSFER_OUT } from "../../interface/event";
import { ILpCmd } from "../../interface/interface";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import { BaseEventProcess } from "./base_event_process";

import * as _ from "lodash";

class EventProcessTransferOut extends BaseEventProcess {
  /**
   * Description 转入事件的基本处理
   * 1.time_lock 的时间不能过长，也就是说，如果锁定报价后一定时间内不转入，则取消
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
      const orderId = await this.verificationBaseParameters(msg);
      ammContext = await ammContextModule
        .findOne({
          "systemOrder.orderId": orderId,
        })
        .lean();
      if (!ammContext) {
        throw new Error(`No order found`);
      }
      await this.verificationTime(msg);
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
    logger.info(`修改信息`, _.get(doc, "systemOrder.transferOutInfo", {}));
  }

  private verificationBaseParameters(msg: IEVENT_TRANSFER_OUT): number {
    const orderInfo = _.get(
      msg,
      "business_full_data.pre_business.order_append_data",
      "{}"
    );
    if (!orderInfo) {
      throw new Error("OrderId的附加信息无法找到...");
    }
    const orderId = _.get(JSON.parse(orderInfo), "orderId", undefined);
    if (!orderId || !_.isFinite(orderId)) {
      throw new Error("orderId 解析失败...");
    }
    return orderId;
  }

  private async verificationTime(msg: IEVENT_TRANSFER_OUT) {
    const lockQuoteTimestamp = Number(
      _.get(
        msg,
        "business_full_data.pre_business.swap_asset_information.time_lock",
        0
      )
    );
    if (!_.isFinite(lockQuoteTimestamp) || lockQuoteTimestamp === 0) {
      logger.debug(`没有获得正确的lockQuoteTimestamp`);
      throw new Error(`没有获得正确的lockQuoteTimestamp ${lockQuoteTimestamp}`);
    }
    const eventDelay = new Date().getTime() - lockQuoteTimestamp * 1000;
    if (eventDelay > 1000 * 60 * 5) {
      logger.error(`距离锁定价格的时间过长,延迟为:${eventDelay}`);
      throw new Error(`距离锁定价格的时间过长,延迟为:${eventDelay}`);
    }
  }

  // @ts-ignore
  private async checkTransferoutAmount(msg: IEVENT_TRANSFER_OUT) {
    //
  }
}

const eventProcessTransferOut: EventProcessTransferOut =
  new EventProcessTransferOut();
export { eventProcessTransferOut };
