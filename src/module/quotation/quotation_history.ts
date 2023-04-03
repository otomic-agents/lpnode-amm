import { dataRedis } from "../../redis_bus";
import { logger } from "../../sys_lib/logger";

/**
 * 在内存或者Redis中存储所有的历史报价，用于查询
 * */
class QuotationListHistory {
  public async store(quoteHash: string, quoteData: any) {
    const className = this.constructor.name;
    const key = `LpLoginSys:${className}:${quoteHash}`;
    dataRedis
      .setex(key, 60 * 60 * 8, new Date().getTime().toString()) // 这里的存储时间要长一些
      .catch((e: any) => {
        logger.error(`set quote history error key`, e);
      });
    const dataKey = `LpLoginSys:${className}:QUOTE:${quoteHash}`;
    dataRedis
      .setex(dataKey, 60 * 60 * 8, JSON.stringify(quoteData))
      .catch((e: any) => {
        logger.error(`set quote history error dataKey`, e);
      });
  }
  public async getHistory(quoteHash: string) {
    const className = this.constructor.name;
    return await dataRedis.get(`LpLoginSys:${className}:${quoteHash}`);
  }
  public async getHistoryData(quoteHash: string) {
    const className = this.constructor.name;
    return await dataRedis.get(`LpLoginSys:${className}:QUOTE:${quoteHash}`);
  }
}
const quotationListHistory: QuotationListHistory = new QuotationListHistory();
export { quotationListHistory };
