import IORedis from "ioredis";
import { logger } from "./logger";

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const Redis = require('ioredis');
import Redis from "ioredis";

class SysIoRedis {
  public static getRedis(
    host: string,
    pass: string | undefined,
    port = 6379,
    db = 0
  ): IORedis.Redis {
    const redisClient = new Redis({
      host,
      port,
      db,
      password: pass,
      retryStrategy(times: number) {
        logger.error(
          `redis Host:${host},port:${port}正在进行第${times}次重新链接`
        );
        const delay = Math.min(times * 50, 1000 * 10);
        return delay;
      },
    });

    redisClient.on("error", (err: any) => {
      logger.error("链接redis发生了错误", host, pass, err);
    });
    return redisClient;
  }
}
export { SysIoRedis };
