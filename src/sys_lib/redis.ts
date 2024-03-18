import IORedis from "ioredis";
import { logger } from "./logger";

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const Redis = require('ioredis');
import Redis from "ioredis";
let systemRedisConnCount = 0;
class SysIoRedis {
  public static getRedis(
    host: string,
    pass: string | undefined,
    port = 6379,
    db = 0
  ): IORedis.Redis {
    systemRedisConnCount++;
    const redisClient = new Redis({
      host,
      port,
      db,
      password: pass,
      retryStrategy(times: number) {
        logger.error(
          `redis Host:${host},port:${port} reconnect number ${times}`
        );
        const delay = Math.min(times * 50, 1000 * 10);
        return delay;
      },
    });
    redisClient["keepRunner"] = setInterval(() => {
      redisClient.ping();
    }, 1000 * 5);
    redisClient.on("close", () => {
      logger.warn(`redis conn close,Host:${host},port:${port}`);
    });
    redisClient.on("error", (err: any) => {
      logger.error("connect redis error", host, err);
    });
    return redisClient;
  }
}
setInterval(() => {
  logger.info(`system redis conn count:${systemRedisConnCount}`);
}, 1000 * 10);
export { SysIoRedis };
