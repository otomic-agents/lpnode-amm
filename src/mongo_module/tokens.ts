import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const tokensSchema = new Schema({
  address: String,
  chainId: Number,
  coinType: String,
  marketName: String,
  precision: Number,
  tokenName: String,
});
export const tokensModule = mongoConn.model(
  "TokensModule",
  tokensSchema,
  "tokens"
);
