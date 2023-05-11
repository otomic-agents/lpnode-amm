import { Schema } from "mongoose";

const mongoose = require("mongoose");
import { Mdb } from "../module/database/mdb";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const bridgesSchema = new Schema({
  _id: mongoose.ObjectId,
  address: String,
  chainId: Number,
  coinType: String,
  marketName: String,
  precision: Number,
  tokenName: String,
  ammName: String,
});
export const bridgesModule = mongoConn.model(
  "bridgesModule",
  bridgesSchema,
  "bridges"
);
