import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";
import * as _ from "lodash";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const channelMessageSchema = new Schema({
  channelName: String,
  message: Object,

});


export const channelMessageModule = mongoConn.model(
  "channelMessageModule",
  channelMessageSchema,
  `channelMessage_${_.get(process.env, "APP_NAME")}`
);
