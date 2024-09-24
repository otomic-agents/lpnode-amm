import { AmmContext } from "../../interface/context";
import { BaseEventProcess } from "./base_event_process";
import { ammContextModule } from "../../mongo_module/amm_context";
import * as _ from "lodash"
import { EFlowStatus } from "../../interface/interface";
class EventProcessTransferInRefund extends BaseEventProcess {

    public async process(msg: any): Promise<void> {
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
        const doc = await ammContextModule
            .findOneAndUpdate(
                { "systemOrder.orderId": orderId },
                {
                    $set: {
                        "flowStatus": EFlowStatus.TransferInefund,
                        "dexTradeInfo_in_refund": {
                            rawData: _.get(
                                msg,
                                "business_full_data.event_transfer_in_refund",
                                {}
                            ),
                        },
                        "systemOrder.transferInRefundTimestamp": new Date().getTime(),
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
    private verificationBaseParameters(msg: any): number {
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
const eventProcessTransferInRefund: EventProcessTransferInRefund = new EventProcessTransferInRefund()
export {
    eventProcessTransferInRefund
}