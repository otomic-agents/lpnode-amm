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
  tradeStatus: Number,
  profitStatus: Number,
  flowStatus: String,
  dexTradeInfo_out: Object,
  dexTradeInfo_out_confirm: Object,
  dexTradeInfo_out_refund: Object,
  dexTradeInfo_in: Object,
  dexTradeInfo_in_confirm: Object,
  dexTradeInfo_in_refund: Object,
  createtime: {
    type: Date,
    default: Date.now,
  },
});

ammContextSchema.index({ "systemOrder.id": 1, type: -1 });
ammContextSchema.index({ tradeStatus: 1, type: -1 });
ammContextSchema.index({ profitStatus: 1, type: -1 });
ammContextSchema.index({ flowStatus: 1, type: -1 });


export const ammContextModule = mongoConn.model(
  "ammContextModule",
  ammContextSchema,
  `ammContext_${_.get(process.env, "APP_NAME")}`
);
