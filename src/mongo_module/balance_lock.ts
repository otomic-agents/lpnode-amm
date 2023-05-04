import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const balanceLockSchema = new Schema({
  accountId: String,
  quoteHash: String,
  record: Object,
  ammName: String,
  createTime: {
    type: Date,
    default: Date.now(),
    expires: 600, // 10 minutes to expire
  },
});
export const balanceLockModule = mongoConn.model(
  "balanceLockModule",
  balanceLockSchema,
  "balanceLock"
);
