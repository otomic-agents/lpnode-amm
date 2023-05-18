import { Schema } from "mongoose";
import { Mdb } from "../module/database/mdb";

const dbKey = "main";
const mongoConn = Mdb.getInstance().getMongoDb(dbKey);
const installSchema = new Schema({
  installType: String,
  name: String,
});
export const installModule = mongoConn.model(
  "installModule",
  installSchema,
  "install"
);
