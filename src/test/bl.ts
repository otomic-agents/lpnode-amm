const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env file does not exist");
}
import { appEnv } from "../app_env";
appEnv.initConfig();
import { Mdb } from "../module/database/mdb";
Mdb.getInstance().getMongoDb("main");

async function main() {
  await Mdb.getInstance().awaitDbConn("business");
  const result = await Mdb.getInstance()
    .getMongoDb("business")
    .collection("business")
    .find({})
    .toArray();
  console.log(result);
}

main()
  .then()
  .catch((e: any) => {
    console.error(e);
  });
