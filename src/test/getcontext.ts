const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("./env.js");
} else {
  console.log("env File 不存在");
}
import { Mdb } from "../module/database/mdb";
import { ammContextModule } from "../mongo_module/amm_context";
Mdb.getInstance().getMongoDb("main"); // 初始化数据库链接

async function main() {
  await Mdb.getInstance().awaitDbConn("main");
  console.log(JSON.stringify(ammContextModule.find({}).lean()));
}

main()
  .then()
  .catch((e: any) => {
    console.error(e);
  });
