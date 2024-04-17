import { logger } from "./sys_lib/logger";
import { SysIoRedis } from "./sys_lib/redis";

import * as _ from "lodash";
const host: any = _.get(process.env, "REDIS_HOST", "");
const port = Number(_.get(process.env, "REDIS_PORT", 6379));
const pass: any = _.attempt(() => {
  const pass = _.get(process.env, "REDIS_PASSWORD", "");
  if (pass === "") {
    return undefined;
  }
  return pass;
});
logger.debug(`redis conn info`, host);
const redisSub = SysIoRedis.getRedis(host, pass, port, 0);
const redisPub = SysIoRedis.getRedis(host, pass, port, 0);
const dataRedis = SysIoRedis.getRedis(host, pass, port, 0);
const statusRedis = SysIoRedis.getRedis(host, pass, port, 0);
function getNewRedis(db = 0) {
  logger.debug(`get new redis ins`, db);
  return SysIoRedis.getRedis(host, pass, port, db);
}
function getRedisConfig() {
  return {
    host,
    pass,
    port,
  };
}
export {
  redisPub,
  redisSub,
  dataRedis,
  statusRedis,
  getRedisConfig,
  getNewRedis,
};
