import { dataRedis } from "./redis_bus";
import * as _ from "lodash";
import { logger } from "./sys_lib/logger";
class RedisStore {
  private listKey: string;
  private pre = "STORE";
  public constructor(listKey: string) {
    this.listKey = listKey.toUpperCase();
  }

  /**
   * Description return inc id
   * @date 2023/2/8 - 15:00:28
   *
   * @public
   * @async
   * @param {string} key "key"
   * @returns {number} "id"
   */
  public async getIncKey(key: string) {
    const redisKey = `${this.pre}:INC:${key.toUpperCase}`;
    return await dataRedis.incr(redisKey);
  }
  private getListKey() {
    return `${this.pre}:${this.listKey}`;
  }
  public async getDataFromPrimaryKey(key: number) {
    if (!_.isFinite(key)) {
      throw new Error(`primary key format is incorrect ${typeof key}`);
    }
    const storeKey = `${this.getListKey()}:PSTORE:${key.toString()}`;
    return await dataRedis.get(storeKey);
  }
  public async getList() {
    const listKey = this.getListKey();
    const retData: any[] = [];
    const list = await dataRedis.zrange(listKey, 0, -1, "WITHSCORES");
    for (let i = 0; i < list.length; i++) {
      if (i % 2 === 0) {
        //
      } else {
        const data = {
          score: list[i],
          val: JSON.parse(list[i - 1]),
        };
        retData.push(data);
      }
    }
    return retData;
  }
  public async updateDataByPrimaryKey(key: number, data: any) {
    if (!_.isFinite(key)) {
      throw new Error(`primary key format is incorrect ${typeof key}`);
    }
    const storeKey = `${this.getListKey()}:PSTORE:${key.toString()}`;
    await dataRedis.set(storeKey, JSON.stringify(data));
  }
  public async appendDataByPrimaryKey(key: number, data: any) {
    if (!_.isFinite(key)) {
      throw new Error(`primary key format is incorrect ${typeof key}`);
    }
    const storeKey = `${this.getListKey()}:PSTORE:${key.toString()}`;
    const sourceData = await dataRedis.get(storeKey);
    if (!sourceData) {
      return null;
    }
    const sourceStruct = JSON.parse(sourceData);
    Object.assign(sourceStruct, data);
    await dataRedis.set(storeKey, JSON.stringify(sourceStruct));
  }
  public async getMaxPrimaryKey() {
    const listMaxPkKey = `${this.getListKey()}:MAX_PRIMARY_KEY`;
    const maxPk = await dataRedis.get(listMaxPkKey);
    if (!maxPk) {
      dataRedis.set(listMaxPkKey, 0);
      return 0;
    }
    return Number(maxPk);
  }
  public async getDataFromIndex(findOption: { [key: string]: string }) {
    for (const findKey in findOption) {
      const value = _.get(findOption, findKey, undefined);
      if (!value) {
        return null;
      }
      const indexKey =
        this.getListKey() + `:PSTORE:INDEX:${findKey}:${value.toString()}`;
      const storeKey = await dataRedis.get(indexKey);
      if (!storeKey) {
        return null;
      }
      const result = await dataRedis.get(storeKey);
      return result;
    }
  }

  public async insertData(
    data: any,
    indexConfig: { [key: string]: string }
  ): Promise<number> {
    const listKey = this.getListKey();

    for (const indexKey in indexConfig) {
      const indexData = _.get(data, `${indexKey}`, undefined);
      if (!indexData) {
        throw new Error(
          `index is define,but no data provided,index key ${indexKey}`
        );
      }
      const indexStoreKey =
        this.getListKey() + `:PSTORE:INDEX:${indexKey}:${indexData.toString()}`;
      const exist = await dataRedis.exists(indexStoreKey);
      if (exist) {
        throw new Error(`index conflict Key:${indexKey} Val:${indexData}`);
      }
    }

    const primaryKey = (await this.getMaxPrimaryKey()) + 1;
    const storeKey = this.getListKey() + ":PSTORE:" + primaryKey;
    _.set(data, "_primaryKey", primaryKey);
    await dataRedis.set(storeKey, JSON.stringify(data));

    for (const indexKey in indexConfig) {
      const indexData = _.get(data, `${indexKey}`, undefined);

      await dataRedis.set(
        this.getListKey() + `:PSTORE:INDEX:${indexKey}:${indexData.toString()}`,
        storeKey
      );
    }

    await dataRedis.zadd(listKey, primaryKey, JSON.stringify(data));

    const listMaxPkKey = `${this.getListKey()}:MAX_PRIMARY_KEY`;
    await dataRedis.incr(listMaxPkKey);
    return primaryKey;
  }

  public async removeByPrimaryKey(key: number, indexConfig: any = undefined) {
    if (!_.isFinite(key)) {
      throw new Error(`primary key format is incorrect ${typeof key}`);
    }
    const storeKey = `${this.getListKey()}:PSTORE:${key.toString()}`;
    const listKey = `${this.getListKey()}`;
    const [primaryDataStr, scoreStr] = await dataRedis.zrangebyscore(
      listKey,
      key,
      key,
      "WITHSCORES"
    );
    try {
      if (parseInt(scoreStr) !== key) {
        throw new Error(
          `delete error want ${parseInt(scoreStr)} ,Input:${key}`
        );
      }
      const storeData = JSON.parse(primaryDataStr);
      for (const indexKey in indexConfig) {
        const indexData = _.get(storeData, indexKey, undefined);
        if (!indexData) {
          logger.debug(`can't find index`);
          continue;
        }
        const indexRedisKey =
          this.getListKey() +
          `:PSTORE:INDEX:${indexKey}:${indexData.toString()}`;
        logger.info(`delete index data`, indexRedisKey);
        await dataRedis.del(indexRedisKey);
      }
      logger.info(`delete Store Data`, storeKey);
      await dataRedis.del(storeKey);

      await dataRedis.zremrangebyscore(listKey, key, key);
    } catch (e) {
      throw e;
    }
  }
}
export { RedisStore };
