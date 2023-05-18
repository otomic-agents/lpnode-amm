import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";
import * as _ from "lodash";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const channelMessageSchema = new Schema({
  channelName: String,
  message: Object,

  createAt: {
    type: Date,
    default: Date.now,
  },
});
channelMessageSchema.index(
  { createAt: 1 },
  { expireAfterSeconds: 3600 * 24 * 7 }
);

export const channelMessageModule = mongoConn.model(
  "channelMessageModule",
  channelMessageSchema,
  `channelMessage_${_.get(process.env, "APP_NAME")}`
);
