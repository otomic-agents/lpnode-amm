import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main"; // model 链接的数据库
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const hedgeJobSchema = new Schema({
  jobRaw: Object,
});
export const hedgeJobModule = mongoConn.model(
  "HedgeJobModule",
  hedgeJobSchema,
  "hedgeJobs"
);
