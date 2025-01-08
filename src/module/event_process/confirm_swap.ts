import { AmmContext } from "../../interface/context";
import { IEVENT_CONFIRM_SWAP } from "../../interface/event"; // Assuming this interface exists
import { ETradeStatus } from "../../interface/interface";
import { ammContextModule } from "../../mongo_module/amm_context";
import { BaseEventProcess } from "./base_event_process";
import * as _ from "lodash";

class EventProcessConfirmSwap extends BaseEventProcess {
    public async process(msg: IEVENT_CONFIRM_SWAP): Promise<void> {
        let ammContext: AmmContext;
        const orderId = await this.verificationBaseParameters(msg);

        // Find the existing context for the order
        ammContext = await ammContextModule
            .findOne({
                "systemOrder.orderId": orderId,
            })
            .lean();

        if (!ammContext) {
            throw new Error(`No order found`);
        }

        // Update the context with the ConfirmSwap event data
        const doc = await ammContextModule
            .findOneAndUpdate(
                { "systemOrder.orderId": orderId },
                {
                    $set: {
                        tradeStatus: ETradeStatus.TransferConfirmSwap,
                        "dexTradeInfo_confirm_swap": {
                            rawData: _.get(
                                msg,
                                "business_full_data.event_confirm_swap",
                                {}
                            ),
                        },
                        "systemOrder.confirmSwapTimestamp": new Date().getTime(),
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

    private verificationBaseParameters(msg: IEVENT_CONFIRM_SWAP): number {
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

const eventProcessConfirmSwap: EventProcessConfirmSwap = new EventProcessConfirmSwap();
export { eventProcessConfirmSwap };
