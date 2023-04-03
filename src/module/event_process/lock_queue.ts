import Bull from "bull";
import { getRedisConfig } from "../../redis_bus";
import * as _ from "lodash";
const redisConfig = getRedisConfig();
const appName = _.get(process.env, "APP_NAME", undefined);
if (!appName) {
  throw new Error(`Queue name is incorrectly configured`);
}
const lockEventQueue = new Bull(`SYSTEM_EVENT_LOCK_QUEUE_${appName}`, {
  redis: { port: 6379, host: redisConfig.host, password: redisConfig.pass },
});
export { lockEventQueue };
