import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";
import { boolean, number, string } from "mathjs";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const chainBalanceLockSchema = new Schema({
  qotationHash: string,
  tokenId: string,
  amount: number,
  walletName: string,
  stepTimeLock: number,
  locked: boolean,
  isTimeout: boolean,
  lockedTime: {
    type: Number, // 使用 Number 类型来存储时间戳（毫秒格式）
    default: Date.now, // 默认值为当前时间戳
  },
  createTime: {
    type: Date,
    default: Date.now(),
    expires: 259200, // 10 minutes to expire
  },
});
export const chainBalanceLockModule = mongoConn.model(
  "chainBalanceLockModule",
  chainBalanceLockSchema,
  "chainBalanceLock"
);
