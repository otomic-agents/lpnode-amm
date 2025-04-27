import * as _ from "lodash"
import { AmmDatabaseContext } from '../../interface/amm_database_context';
export class CalculateProcessBase {

    protected getSwapType(row: AmmDatabaseContext): string {
        let transactionType = "atomic"
        try {
            const hasTransaction = row.hasTransaction;
            const transactionOut = _.get(row, "dexTradeInfo_out", undefined)
            const transactionInitSwap = _.get(row, "dexTradeInfo_init_swap", undefined)
            if (transactionInitSwap != undefined && _.isObject(transactionInitSwap)) {
                transactionType = "singleSwap";
            }

        } catch (e) {

        }
        return transactionType
    }
    protected isTransactionCompleted(row: AmmDatabaseContext): boolean {
        let completed = false;
        const swapType = this.getSwapType(row)
        if (swapType === "atomic") {
            const transactionInRefund = _.get(row, "dexTradeInfo_in_refund", undefined)
            const dexTradeInfoInConfirm = _.get(row, "dexTradeInfo_in_confirm", undefined)
            if (transactionInRefund != undefined || dexTradeInfoInConfirm != undefined) {
                completed = true
            }
            const endTime = this.getAtomicTransactionEndTimer(row)
            if (new Date().getTime() > endTime) {
                completed = true
            }
            return completed
        }
        if (swapType === "singleSwap") {
            const dexTradeInfoConfirmSwap = _.get(row, "dexTradeInfo_confirm_swap", undefined)
            const dexTradeInfoRefundSwap = _.get(row, "dexTradeInfo_refund_swap", undefined)
            if (dexTradeInfoConfirmSwap != undefined || dexTradeInfoRefundSwap != undefined) {
                completed = true
            }
            const endTime = this.getSingleSwapTransactionEndTimer(row)
            if (new Date().getTime() > endTime) {
                completed = true
            }
            return completed
        }
        return completed;
    }
    protected getAtomicTransactionEndTimer(row: AmmDatabaseContext): number {
        // const 
        const agreementReachedTime = _.get(row, "swapAssetInformation.agreement_reached_time", undefined)
        const expectedSingleStepTime = _.get(row, "swapAssetInformation.expected_single_step_time", undefined);
        const tolerantSingleStepTime = _.get(row, "swapAssetInformation.tolerant_single_step_time", undefined);
        if (agreementReachedTime === undefined ||
            expectedSingleStepTime === undefined ||
            tolerantSingleStepTime === undefined) {
            console.error("Missing required time parameters");
            return null;
        }

        const lastFrameStartTime = agreementReachedTime +
            (3 * expectedSingleStepTime) +
            (3 * tolerantSingleStepTime);
        return lastFrameStartTime * 1000;
    }
    protected getSingleSwapTransactionEndTimer(row: AmmDatabaseContext): number {

        // const 
        const agreementReachedTime = _.get(row, "swapAssetInformation.agreement_reached_time", undefined)
        const expectedSingleStepTime = _.get(row, "swapAssetInformation.expected_single_step_time", undefined);
        if (agreementReachedTime === undefined ||
            expectedSingleStepTime === undefined) {
            console.error("Missing required time parameters");
            return null;
        }

        const lastFrameStartTime = agreementReachedTime +
            (2 * expectedSingleStepTime)
        return lastFrameStartTime * 1000;
    }
}