import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisProvider } from '../providers/database/redis.provider';
import { MongoProvider } from '../providers/database/mongo.provider';
import * as _ from 'lodash';

interface IOrderbookStoreItem {
  stdSymbol: string;
  symbol: string;
  lastUpdateId: number;
  timestamp: number;
  incomingTimestamp: number;
  stream: string;
  bids: string[][];
  asks: string[][];
}

@Injectable()
export class MarketDataSyncService implements OnModuleInit {
  private readonly logger = new Logger(MarketDataSyncService.name);
  private readonly SYNC_INTERVAL = 10000; // 10 seconds
  private marketCollection;

  constructor(
    private readonly redisProvider: RedisProvider,
    private readonly mongoProvider: MongoProvider,
  ) {}

  async onModuleInit() {
    this.marketCollection = this.mongoProvider.getCollection('market_orderbooks');
    this.startSyncLoop();
  }

  private async startSyncLoop() {
    while (true) {
      try {
        await this.syncMarketData();
      } catch (error) {
        this.logger.error('Error syncing market data:', error);
      } finally {
        await new Promise(resolve => setTimeout(resolve, this.SYNC_INTERVAL));
      }
    }
  }

  private async syncMarketData() {
    const redisClient = await this.redisProvider.getClient();
    const symbolsStr = await redisClient.get('LP_MARKET_SYMBOLS');
    const symbols = JSON.parse(symbolsStr);

    const bulkOps = [];
    
    for (const symbol of symbols) {
      try {
        const orderbookStr = await redisClient.get(symbol);
        const orderbook = JSON.parse(orderbookStr);

        if (!_.get(orderbook, 'bids')) {
          if (!this.isSpecialToken(symbol)) {
            this.logger.warn(`empty bid orderbook ${symbol}`);
          }
          continue;
        }

        const orderbookItem: IOrderbookStoreItem = {
          stdSymbol: orderbook.symbol,
          symbol: orderbook.symbol,
          lastUpdateId: 0,
          timestamp: orderbook.timestamp,
          incomingTimestamp: Date.now(),
          stream: 'spot',
          bids: orderbook.bids.map(bid => bid.map(item => item.toString())),
          asks: orderbook.asks.map(ask => ask.map(item => item.toString())),
        };

        bulkOps.push({
          updateOne: {
            filter: { symbol: orderbook.symbol },
            update: { $set: orderbookItem },
            upsert: true
          }
        });
      } catch (error) {
        this.logger.error(`Error processing symbol ${symbol} data:`, error);
      }
    }

    if (bulkOps.length > 0) {
      await this.marketCollection.bulkWrite(bulkOps);
      this.logger.debug(`Successfully synced market data for ${bulkOps.length} symbols`);
    }
  }

  private isSpecialToken(symbol: string): boolean {
    // Implement special token logic
    return false;
  }
}
