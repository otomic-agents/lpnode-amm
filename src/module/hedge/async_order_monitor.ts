import { AmmContext } from "../../interface/context";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import * as _ from "lodash";
import { ISpotOrderResult } from "../../interface/std_difi";
import { EFlowStatus } from "../../interface/interface";
class AsyncOrderMonitor {
  public constructor() {
    logger.info(`init AsyncOrderMonitor`);
  }
  public async onOrder(orderData: ISpotOrderResult) {
    console.log("________________");
    logger.info(`order data`, orderData);
    console.log("________________");
    const clientOrderId = _.get(orderData, "clientOrderId", "");
    if (!clientOrderId || clientOrderId === "") {
      logger.error(
        `Unable to parse client orderid from order message`,
        orderData
      );
      return;
    }
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "systemOrder.hedgePlanClientOrderIdList": clientOrderId,
      })
      .lean();
    if (!ammContext) {
      logger.error(
        `The order message was received, but the hedging context could not be found`,
        orderData
      );
      return;
    }
    this.updateHedgeData(ammContext, orderData);
  }
  private async updateHedgeData(
    ammContext: AmmContext,
    orderData: ISpotOrderResult
  ) {
    const clientOrderId = _.get(orderData, "clientOrderId", "");
    const hedgeResult = _.get(ammContext, "systemOrder.hedgeResult", []);
    if (!_.isArray(hedgeResult) || hedgeResult.length <= 0) {
      logger.error(`Unable to find the right hedging plan`);
      return;
    }
    const rowIndex = _.findIndex(hedgeResult, (item) => {
      return _.get(item, "plan.orderId", "") === clientOrderId;
    });
    logger.debug(rowIndex);
    logger.debug(`update context status `);
    const key = `systemOrder.hedgeResult.${rowIndex}.asyncExecuteResult`;
    const data = {};
    data[key] = orderData;
    data["flowStatus"] = EFlowStatus.HedgeCompletion;
    try {
      const find = {
        "systemOrder.orderId": ammContext.systemOrder.orderId,
      };
      const set = {
        $set: data,
      };
      logger.debug(find, set);
      await ammContextModule.findOneAndUpdate(find, set);
    } catch (e) {
      logger.error(`Update context status error`, e);
    }
    // find hedge result index and update
    // ISpotOrderResult
    //
  }
}
export { AsyncOrderMonitor };
