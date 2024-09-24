import { AmmContext } from "../../interface/context";
import { IEVENT_TRANSFER_IN_CONFIRM } from "../../interface/event";
import { ammContextModule } from "../../mongo_module/amm_context";
import { BaseEventProcess } from "./base_event_process";
import * as _ from "lodash";
class EventProcessTransferInConfirm extends BaseEventProcess {
    public async process(msg: IEVENT_TRANSFER_IN_CONFIRM): Promise<void> {
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
                        "dexTradeInfo_in_confirm": {
                            rawData: _.get(
                                msg,
                                "business_full_data.event_transfer_in_confirm",
                                {}
                            ),
                        },
                        "systemOrder.transferInConfirmTimestamp": new Date().getTime(),
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
    private verificationBaseParameters(msg: IEVENT_TRANSFER_IN_CONFIRM): number {
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

const eventProcessTransferInConfirm: EventProcessTransferInConfirm = new EventProcessTransferInConfirm()
export {
    eventProcessTransferInConfirm
}