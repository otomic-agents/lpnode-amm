import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const balanceLockSchema = new Schema({
  accountId: String,
  quoteHash: String,
  record: Object,
  createTime: {
    type: Date,
    default: Date.now(),
    expires: 600, // 10 分钟后锁定过期
  },
});
export const balanceLockModule = mongoConn.model(
  "balanceLockModule",
  balanceLockSchema,
  "balanceLock"
);
