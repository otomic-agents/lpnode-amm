const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("./env.js");
} else {
  console.log("env file does not exist");
}
import { Mdb } from "../module/database/mdb";
import { ammContextModule } from "../mongo_module/amm_context";
Mdb.getInstance().getMongoDb("main");

async function main() {
  await Mdb.getInstance().awaitDbConn("main");
  console.log(JSON.stringify(ammContextModule.find({}).lean()));
}

main()
  .then()
  .catch((e: any) => {
    console.error(e);
  });
