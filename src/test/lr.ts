const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env file does not exist");
}
import { dataRedis } from "../redis_bus";

import { logger } from "../sys_lib/logger";

async function main() {
  const result = await dataRedis.smembers("KEY_BUSINESS_STATUS_INBUSINESS");
  fs.writeFileSync("out.txt", result[0], { encoding: "utf-8" });
}
main()
  .then()
  .catch((e: any) => {
    logger.error(e);
  });
