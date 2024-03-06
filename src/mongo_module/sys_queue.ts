import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const sysQueueSchema = new Schema({

  queue_name: {
    type: String,
    default: "",
  },
  data: {
    type: Object,
    default: {}
  },
  processed: {
    type: Boolean,
    default: false
  },
  expires: { type: Date }, // 过期时间字段，通常为Date类型

});
sysQueueSchema.index({ expires: 1 }, { expireAfterSeconds: 3600 });
export const sysQueueModel = mongoConn.model(
  "sysQueueModel",
  sysQueueSchema,
  "sysQueue"
);
