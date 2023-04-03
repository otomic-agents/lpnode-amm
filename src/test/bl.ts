const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File 不存在");
}
import { appEnv } from "../app_env"; // 这个要在最前边
appEnv.initConfig(); // 初始化基本配置
import { Mdb } from "../module/database/mdb";
Mdb.getInstance().getMongoDb("main"); // 初始化数据库链接

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
