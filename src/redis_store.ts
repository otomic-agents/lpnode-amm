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
   * Description 返回一个自增长的Id
   * @date 2023/2/8 - 15:00:28
   *
   * @public
   * @async
   * @param {string} key "随便一个key"
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
      throw new Error(`主键格式不正确 ${typeof key}`);
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
      throw new Error(`主键格式不正确 ${typeof key}`);
    }
    const storeKey = `${this.getListKey()}:PSTORE:${key.toString()}`;
    await dataRedis.set(storeKey, JSON.stringify(data));
  }
  public async appendDataByPrimaryKey(key: number, data: any) {
    if (!_.isFinite(key)) {
      throw new Error(`主键格式不正确 ${typeof key}`);
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

  /**
   * Description 写入数据
   * 1. set 存储数据
   * 2. 有序集合维持排序分页
   * 3. 完成索引的存储
   * @date 2/3/2023 - 8:08:48 PM
   *
   * @public
   * @async
   * @param {*} data 存储的数据
   * @param {索引配置} indexConfig {hash:"true"}
   * @returns {number} "主键"
   */
  public async insertData(
    data: any,
    indexConfig: { [key: string]: string }
  ): Promise<number> {
    const listKey = this.getListKey();

    // 检查索引数据是否重复
    for (const indexKey in indexConfig) {
      const indexData = _.get(data, `${indexKey}`, undefined);
      if (!indexData) {
        throw new Error(
          `定义了索引，但是没有数据项没有提供数据,index key ${indexKey}`
        );
      }
      const indexStoreKey =
        this.getListKey() + `:PSTORE:INDEX:${indexKey}:${indexData.toString()}`;
      const exist = await dataRedis.exists(indexStoreKey);
      if (exist) {
        throw new Error(`索引冲突 Key:${indexKey} Val:${indexData}`);
      }
    }
    // 存储数据 Set 结构 存起来
    const primaryKey = (await this.getMaxPrimaryKey()) + 1;
    const storeKey = this.getListKey() + ":PSTORE:" + primaryKey;
    _.set(data, "_primaryKey", primaryKey);
    await dataRedis.set(storeKey, JSON.stringify(data));

    // 处理索引，把数据创建索引 ,索引使用Set 结构保存
    for (const indexKey in indexConfig) {
      const indexData = _.get(data, `${indexKey}`, undefined);
      // if (!indexData) { // 最上面检查过了
      //   logger.warn(`没有索引的数据项`);
      //   continue;
      // }
      await dataRedis.set(
        this.getListKey() + `:PSTORE:INDEX:${indexKey}:${indexData.toString()}`,
        storeKey
      );
    }

    // 维护有序集合
    await dataRedis.zadd(listKey, primaryKey, JSON.stringify(data)); // 主键写入List

    // 自增长主键
    const listMaxPkKey = `${this.getListKey()}:MAX_PRIMARY_KEY`;
    await dataRedis.incr(listMaxPkKey);
    return primaryKey;
  }

  /**
   * Description 根据主键删除数据
   * @date 2023/2/14 - 12:07:49
   *
   * @public
   * @async
   * @param {number} key "主键"
   * @param {*} indexConfig "索引数据"
   * @returns {void} ""
   */
  public async removeByPrimaryKey(key: number, indexConfig: any = undefined) {
    if (!_.isFinite(key)) {
      throw new Error(`主键格式不正确 ${typeof key}`);
    }
    const storeKey = `${this.getListKey()}:PSTORE:${key.toString()}`; // 存数据的Key 类型 String
    const listKey = `${this.getListKey()}`; // 有序集合的key ，删除主键分值
    const [primaryDataStr, scoreStr] = await dataRedis.zrangebyscore(
      listKey,
      key,
      key,
      "WITHSCORES"
    );
    try {
      if (parseInt(scoreStr) !== key) {
        throw new Error(
          `要删除的数据和Key 不匹配,want ${parseInt(scoreStr)} ,Input:${key}`
        );
      }
      const storeData = JSON.parse(primaryDataStr);
      for (const indexKey in indexConfig) {
        const indexData = _.get(storeData, indexKey, undefined);
        if (!indexData) {
          logger.debug(`没有找到索引`);
          continue;
        }
        const indexRedisKey =
          this.getListKey() +
          `:PSTORE:INDEX:${indexKey}:${indexData.toString()}`;
        logger.info(`删除对应的索引数据`, indexRedisKey);
        await dataRedis.del(indexRedisKey);
      }
      logger.info(`删除Store的Data`, storeKey);
      await dataRedis.del(storeKey);
      logger.info(`删除主键列表中的Score`);
      await dataRedis.zremrangebyscore(listKey, key, key);
    } catch (e) {
      throw e;
    }
  }
}
export { RedisStore };
