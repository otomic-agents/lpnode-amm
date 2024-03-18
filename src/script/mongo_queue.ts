import { logger } from "../sys_lib/logger";

const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
logger.info("envFile", envFile);
if (envFile) {
  console.log("require env file ");
  require("../env.js");
} else {
  console.log("env file does not exist");
}
import { appEnv } from "../app_env";
appEnv.initConfig();

import { SysMongoQueue } from "../sys_lib/mongo_queue";

const mq = new SysMongoQueue("test_q");

async function main() {
  mq.process(async (job, done) => {
    console.log("new job ...", job);
    console.log(done);
    done();
  });
}

main().then(() => {
  console.log("execute end..");
  // process.exit(0);
  setTimeout(() => {
    mq.add({ test: 1 });
  }, 5000);
  setTimeout(() => {
    mq.add({ test: 2 });
  }, 20000);
});
