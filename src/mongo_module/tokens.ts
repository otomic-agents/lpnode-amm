import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
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
