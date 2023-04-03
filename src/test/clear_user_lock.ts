const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File 不存在");
}
import { RedisStore } from "../redis_store";
import { logger } from "../sys_lib/logger";

async function main() {
  const store = new RedisStore(`SYSTEM_BALANCE_LOCK_LIST_a001`);
  const storeList: {
    score: string;
    val: {
      accountId: string;
      asset: string;
      lockedTime: number;
      locked: number;
      _primaryKey: number;
    };
  }[] = await store.getList();
  // @ts-ignore
  storeList.map(async (it) => {
    await store.removeByPrimaryKey(it.val._primaryKey);
  });
}
main()
  .then()
  .catch((e: any) => {
    logger.error(e);
  });
