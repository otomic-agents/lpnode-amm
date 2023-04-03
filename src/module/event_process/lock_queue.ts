import Bull from "bull";
import { getRedisConfig } from "../../redis_bus";
const redisConfig = getRedisConfig();
const lockEventQueue = new Bull("SYSTEM_EVENT_LOCK_QUEUE", {
  redis: { port: 6379, host: redisConfig.host, password: redisConfig.pass },
});
export { lockEventQueue };
