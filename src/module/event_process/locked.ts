import { BaseEventProcess } from "./base_event_process";
import { IEVENT_LOCKED_QUOTE } from "../../interface/event";
import { AmmContext } from "../../interface/context";
import { ammContextManager } from "../amm_context_manager/amm_context_manager";
import { ammContextModule } from "../../mongo_module/amm_context";
import _ from "lodash";
class EventProcessLocked extends BaseEventProcess {
    public async process(msg: IEVENT_LOCKED_QUOTE): Promise<void> {
        console.dir(msg, { depth: 5 });
        const businessHash = _.get(
            msg,
            "pre_business.hash",
            undefined
        );
        const quoteHash = _.get(
            msg,
            "pre_business.swap_asset_information.quote.quote_base.quote_hash",
            undefined
        );
        if (!quoteHash) {
            throw new Error(`no quoteHash found`);
        }
        const ammContext: AmmContext =
            await ammContextManager.getContextByQuoteHash(quoteHash);
        if (!ammContext) {
            throw new Error(`no context found`);
        }
        await ammContextModule.updateOne(
            {
                "quoteInfo.quote_hash": _.get(
                    msg,
                    "pre_business.swap_asset_information.quote.quote_base.quote_hash",
                    ""
                ),
            },
            {
                $set: {
                    "businessHash": businessHash,
                },
            }
        );
    }
}

const eventProcessLocked: EventProcessLocked = new EventProcessLocked();
export { eventProcessLocked };


