import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const orderIncSchema = new Schema({
  inumber: {
    type: Number,
    default: 0,
  },
});
export const orderIncModule = mongoConn.model(
  "orderIncModule",
  orderIncSchema,
  "orderInc"
);
