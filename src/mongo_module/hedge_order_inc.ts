import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const hedgeOrderIncSchema = new Schema({
  inumber: {
    type: Number,
    default: 0,
  },
});
export const hedgeOrderIncModule = mongoConn.model(
  "hedgeOrderIncModule",
  hedgeOrderIncSchema,
  "hedgeOrderInc"
);
