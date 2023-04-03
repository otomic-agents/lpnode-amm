import { logger } from "./sys_lib/logger";
import { SysIoRedis } from "./sys_lib/redis";

import * as _ from "lodash";
const host: any = _.attempt(() => {
  return _.get(process.env, "OBRIDGE_LPNODE_DB_REDIS_MASTER_SERVICE_HOST", "");
});
const pass: any = _.attempt(() => {
  const pass = _.get(process.env, "REDIS_PASSWORD", "");
  if (pass === "") {
    return undefined;
  }
  return pass;
});
logger.debug(`redis conn info`, host);
const redisSub = SysIoRedis.getRedis(host, pass, undefined, 0);
const redisPub = SysIoRedis.getRedis(host, pass, undefined, 0);
const dataRedis = SysIoRedis.getRedis(host, pass, undefined, 0);
const statusRedis = SysIoRedis.getRedis(host, pass, undefined, 9);
function getNewRedis(db = 0) {
  return SysIoRedis.getRedis(host, pass, undefined, db);
}
function getRedisConfig() {
  return {
    host,
    pass,
    port: 6379,
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
