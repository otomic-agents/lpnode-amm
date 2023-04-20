import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";
import * as _ from "lodash";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const ammContextSchema = new Schema({
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
});

ammContextSchema.index({ "systemOrder.id": 1, type: -1 });
ammContextSchema.index({ tradeStatus: 1, type: -1 });
ammContextSchema.index({ profitStatus: 1, type: -1 });

export const ammContextModule = mongoConn.model(
  "ammContextModule",
  ammContextSchema,
  `ammContext_${_.get(process.env, "APP_NAME")}`
);
