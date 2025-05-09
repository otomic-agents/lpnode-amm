import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import { HedgeTask } from "./interface/types"
// Define database collection names
const HEDGE_TASK_COLLECTION = 'hedge_tasks';
const CEX_BALANCE_COLLECTION = 'cex_wallet_balances';
const DEX_BALANCE_COLLECTION = 'wallet_dex_all_balances';
import { Collection, ObjectId } from 'mongodb';
interface AssestBalanceFromCex {
  accountName: string;
  exchange: string;
  exchangeResult: {
    balances: {
      asset: string;
      free: string;
    }[];
  };
}

interface TokenBalanceFromDEX {
  chainId: number;
  tokenAddress: string;
  walletAddress: string;
  balance: string;
  chainType: string;
  decimals: number;
  formattedBalance: string;
  symbol: string;
}

@Injectable()
export class HedgeTaskDataSyncService implements OnModuleInit {
  private readonly logger = new Logger(HedgeTaskDataSyncService.name);
  private readonly SYNC_INTERVAL = 60 * 1000; // Sync every minute

  private hedgeTaskCollection: Collection<HedgeTask>;
  private cexBalanceCollection: Collection<AssestBalanceFromCex>;
  private dexBalanceCollection;

  constructor(
    private readonly mongoProvider: MongoProvider,
  ) { }

  async onModuleInit() {
    this.logger.log('Initializing HedgeTaskDataSyncService...');
    try {
      this.hedgeTaskCollection = this.mongoProvider.getCollection<HedgeTask>(HEDGE_TASK_COLLECTION);
      this.cexBalanceCollection = this.mongoProvider.getCollection<AssestBalanceFromCex>(CEX_BALANCE_COLLECTION);
      this.dexBalanceCollection = this.mongoProvider.getCollection(DEX_BALANCE_COLLECTION);

      await this.ensureIndexes();

      this.startSyncLoop();
      this.logger.log('HedgeTaskDataSyncService initialization complete');
    } catch (error: any) {
      this.logger.error('Failed to initialize HedgeTaskDataSyncService:', error.stack || error);
    }
  }

  private async ensureIndexes() {
    try {
      await this.hedgeTaskCollection.createIndex({ status: 1 });
      this.logger.debug('✅ Index ensured on hedge_tasks.status');
    } catch (error: any) {
      this.logger.warn('⚠️ Failed to create index on hedge_tasks.status:', error.message);
    }
  }

  private async startSyncLoop() {
    this.logger.log(`🚀 Starting hedge task sync loop every ${this.SYNC_INTERVAL / 1000}s`);
    while (true) {
      try {
        this.logger.log('🔄 Starting a new sync cycle for active hedge tasks');
        await this.syncActiveHedgeTasks();
        this.logger.log('✅ Sync cycle completed successfully');
      } catch (error: any) {
        this.logger.error('💥 Error in hedge task sync loop:', error.stack || error);
      } finally {
        this.logger.verbose(`⏳ Waiting ${this.SYNC_INTERVAL / 1000}s before next sync...`);
        await new Promise((resolve) => setTimeout(resolve, this.SYNC_INTERVAL));
      }
    }
  }

  private async syncActiveHedgeTasks() {
    const query = { status: 'active' };
  
    // 🔍 Log query condition
    this.logger.debug('🔍 Querying active hedge tasks with filter:', JSON.stringify(query));
  
    const activeTasks = await this.hedgeTaskCollection.find(query).toArray();
    this.logger.log(`🎯 Found ${activeTasks.length} active hedge tasks`);
  
    if (activeTasks.length === 0) {
      this.logger.verbose('ℹ️ No active tasks found. Skipping update process.');
      return;
    }
  
    // 📦 Print first 3 for debug
    this.logger.verbose('📦 Sample of active tasks:', JSON.stringify(activeTasks.slice(0, 3), null, 2));
  
    for (const task of activeTasks) {
      try {
        const tokens = task.chain_pair || [];
        const tokenAddresses = task.chain_address || [];
        const chainIds = task.chain_id_list || [];
        const walletList = task.wallet_list || [];
        
        this.logger.debug(`[${task.name}] 🪙 Tokens involved:`, tokens);
        this.logger.debug(`[${task.name}] 🔗 Chain IDs:`, chainIds);
        this.logger.debug(`[${task.name}] 📝 Token addresses:`, tokenAddresses);
        this.logger.debug(`[${task.name}] 👛 Wallet addresses:`, walletList);
  
        const cexBalances = await this.getCexTokenBalances(task.cex_account_id, tokens);
        const dexBalances = await this.getDexTokenBalances(tokens, tokenAddresses, chainIds, walletList);
  
        const latestBalance = {
          cex: cexBalances,
          dex: dexBalances,
          timestamp: new Date(),
        };
  
        this.logger.debug(`[${task.name}] 💰 Latest balance computed:`, JSON.stringify(latestBalance));
  
        // Use optimistic locking for update
        const result = await this.hedgeTaskCollection.updateOne(
          {
            _id: task._id,
            version: task.version,
          },
          {
            $set: {
              latest_balance: latestBalance,
              updated_at: new Date(),
              version: task.version + 1,
            },
          },
        );
  
        if (result.modifiedCount === 1) {
          this.logger.log(`✅ Updated latest_balance for task "${task.name}"`);
        } else {
          this.logger.warn(`⚠️ Failed to update task "${task.name}", possibly due to version conflict`);
        }
      } catch (error: any) {
        this.logger.error(`❌ Error updating task "${task.name}":`, error.stack || error.message);
      }
    }
  }

  private async getCexTokenBalances(accountId: string, tokens: string[]): Promise<Record<string, number>> {
    const query: any = {
      accountId: accountId.toString(),
    };
    this.logger.debug(`💱 Querying CEX balances with filter:`, JSON.stringify(query));

    const balances = await this.cexBalanceCollection.find(query).toArray();
    this.logger.verbose(`🧾-- Retrieved ${balances.length} CEX balance records.`);

    const result: Record<string, number> = {};
    for (const record of balances) {
      for (const balance of record.exchangeResult.balances) {
        if (tokens.includes(balance.asset)) {
          result[balance.asset] = parseFloat(balance.free);
        }
      }
    }

    this.logger.debug(`🔢 Final CEX balances:`, JSON.stringify(result));
    return result;
  }

  private async getDexTokenBalances(
    tokens: string[],
    tokenAddresses: string[] = [],
    chainIds: number[] = [],
    walletList: string[] = []
  ): Promise<Record<string, number>> {
    // Build more complex query conditions
    const query: any = {};
    
    // Add condition: query for specified token addresses
    if (tokenAddresses && tokenAddresses.length > 0) {
      query.tokenAddress = { $in: tokenAddresses.map(addr => addr) };
    } else if (tokens && tokens.length > 0) {
      // If no specific addresses are provided, try to query by symbol
      query.symbol = { $in: tokens };
    }
  
    // Add condition: query for specified chain IDs
    if (chainIds && chainIds.length > 0) {
      query.chainId = { $in: chainIds };
    }
  
    // Add condition: query for specified wallet addresses
    if (walletList && walletList.length > 0) {
      query.walletAddress = { $in: walletList };
    }
  
    this.logger.debug(`💱 Querying DEX balances with filter:`, JSON.stringify(query));
    const balances = await this.dexBalanceCollection.find(query).toArray();
    this.logger.verbose(`🧾 Retrieved ${balances.length} DEX balance records.`);
  
    // Collect results, group and sum balances by symbol
    const result: Record<string, number> = {};
    for (const record of balances) {
      // Use symbol as key, or tokenAddress if symbol is not available
      const key = record.symbol || record.tokenAddress;
      
      // If this symbol already exists, add to the balance, otherwise create a new record
      const balance = parseFloat(record.formattedBalance || '0');
      if (result[key]) {
        result[key] += balance;
      } else {
        result[key] = balance;
      }
    }
  
    this.logger.debug(`🔢 Final DEX balances:`, JSON.stringify(result));
    return result;
  }
}