import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";
import * as _ from "lodash";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const ammContextSchema = new Schema({
  appName: String,
  hedgeEnabled: Boolean,
  summary: String,
  systemContext: Object,
  chainOptInfo: Object,
  systemInfo: Object,
  walletInfo: Object,
  AskInfo: Object,
  baseInfo: Object,
  swapInfo: Object,
  quoteInfo: Object,
  askTime: Object,
  systemOrder: Object,
  lockInfo: Object,
  tradeStatus: String,

  profitStatus: Number,
  flowStatus: String,
  swapAssetInformation:Object,
  dexTradeInfo_out: Object,
  dexTradeInfo_out_confirm: Object,
  dexTradeInfo_out_refund: Object,
  dexTradeInfo_in: Object,
  dexTradeInfo_in_confirm: Object,
  dexTradeInfo_in_refund: Object,
  dexTradeInfo_init_swap: Object,
  dexTradeInfo_confirm_swap: Object,
  dexTradeInfo_refund_swap: Object,
  hasTransaction: Boolean,
  baseProcessed:Boolean,
  transactionCompleted:Boolean,
  swapProcessed:Boolean,
  businessHash:String,
  createtime: {
    type: Date,
    default: Date.now,
  },
});

ammContextSchema.index({ "systemOrder.id": 1, type: -1 });
ammContextSchema.index({ tradeStatus: 1, type: -1 });
ammContextSchema.index({ profitStatus: 1, type: -1 });
ammContextSchema.index({ flowStatus: 1, type: -1 });
ammContextSchema.index({ "quoteInfo.quote_hash": 1, type: -1 });
ammContextSchema.index({ "businessHash": 1, type: -1 });

ammContextSchema.index({
  "hasTransaction": 1,
  "_id": -1
}, {
  background: true,
  name: "idx_hasTransaction_id"
});


ammContextSchema.index({
  baseProcessed: 1,
  hasTransaction: 1,
  transactionCompleted: 1,
  swapProcessed: 1
}, {
  background: true,
  name: "idx_transaction_processing_status"
});


ammContextSchema.index({ swapProcessed: 1 }, {
  background: true,
  name: "idx_swapProcessed",
  sparse: true 
});

export const ammContextModule = mongoConn.model(
  "ammContextModule",
  ammContextSchema,
  `ammContext_${_.get(process.env, "APP_NAME")}`
);
