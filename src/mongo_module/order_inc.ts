import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
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
