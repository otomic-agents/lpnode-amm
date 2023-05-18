import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const chainListSchema = new Schema({
  chainId: Number,
  chainName: String,
  name: String,
  tokenName: String,
  tokenUsd: Number,
  chainType: String,
});
export const chainListModule = mongoConn.model(
  "ChainListModule",
  chainListSchema,
  "chainList"
);
