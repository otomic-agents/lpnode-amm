import { getNewRedis } from "../../redis_bus";
import { logger } from "../../sys_lib/logger";

const exchangeReidsIns = getNewRedis();
class ExchangeRedisStore {
  public async hset(key: string, subkey: string, value: string) {
    try {
      await exchangeReidsIns.hset(key, subkey, value);
    } catch (e) {
      logger.error(e);
    }
  }
}
const exchangeRedisStore: ExchangeRedisStore = new ExchangeRedisStore();
export { exchangeRedisStore };
