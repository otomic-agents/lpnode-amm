import { AmmContext } from "../../interface/context";
import { ammContextModule } from "../../mongo_module/amm_context";
import { logger } from "../../sys_lib/logger";
import * as _ from "lodash";
import { ISpotOrderResult } from "../../interface/std_difi";
import { EFlowStatus } from "../../interface/interface";
class AsyncOrderMonitor {
  private executionOrderQueue: Map<string, any> = new Map();
  public constructor() {
    logger.info(`AsyncOrderMonitor loaded`);
  }
  private freeexecutionOrderQueue(clientOrderId: string) {
    const createResult = this.executionOrderQueue.get(clientOrderId);
    if (!createResult) {
      logger.warn(`Could not find create record orderId:${clientOrderId}`);
    }
    if (createResult) {
      if (createResult.time) {
        logger.debug(`clear timeout check`);
        clearTimeout(createResult.time);
      }
    }
  }
  public async onOrder(orderData: ISpotOrderResult | undefined) {
    if (!orderData) {
      logger.error(`order is not parsed correctly `);
      return;
    }
    console.log("________________");
    logger.info(`order data`, orderData);
    console.log("________________");
    const clientOrderId = _.get(orderData, "clientOrderId", "");
    logger.debug("delete cached client event");

    if (!clientOrderId || clientOrderId === "") {
      logger.error(
        `Unable to parse client orderid from order message`,
        orderData
      );
      return;
    }
    this.freeexecutionOrderQueue(clientOrderId);

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
  public async onOrderFail(orderId: string, rawData: any) {
    const clientOrderId = orderId;
    if (!clientOrderId || clientOrderId === "") {
      logger.error(
        `Unable to parse client orderid from order message`,
        rawData
      );
      return;
    }
    this.freeexecutionOrderQueue(orderId);
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "systemOrder.hedgePlanClientOrderIdList": clientOrderId,
      })
      .lean();
    if (!ammContext) {
      logger.error(
        `The order message was received, but the hedging context could not be found onOrderFail`,
        rawData
      );
      return;
    }
    this.updateHedgeFailData(ammContext, clientOrderId, rawData);
  }
  private async updateHedgeFailData(
    ammContext: AmmContext,
    clientOrderId: string,
    rawData: any
  ) {
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
    const key = `systemOrder.hedgeResult.${rowIndex}.commitResult`;
    const statusKey = `systemOrder.hedgeResult.${rowIndex}.status`;
    const data = {};
    //@ts-ignore
    data[key] = rawData;
    //@ts-ignore
    data[statusKey] = 3; // update status
    //@ts-ignore
    data["flowStatus"] = EFlowStatus.HedgeFailure;
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
      logger.error(`updateHedgeFailData Update context status error`, e);
    }
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
    const key = `systemOrder.hedgeResult.${rowIndex}.result`;
    const statusKey = `systemOrder.hedgeResult.${rowIndex}.status`;
    const data = {};
    //@ts-ignore
    data[key] = orderData;
    //@ts-ignore
    data[statusKey] = 1; // update status
    //@ts-ignore
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
  public async onClientCreateOrder(orderId: string, orderData: any) {
    this.executionOrderQueue.set(orderId, {
      eventTime: new Date().getTime(),
      orderCommitData: orderData,
      time: ((orderId) => {
        return setTimeout(() => {
          const executionOrderItem = this.executionOrderQueue.get(orderId);
          if (executionOrderItem) {
            logger.error(`${orderId} execute timeout`);
          }
        }, 5000);
      })(orderId),
    });
  }
}
export { AsyncOrderMonitor };
