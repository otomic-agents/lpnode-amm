import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import axios from 'axios';
import { Collection } from 'mongodb';

// RPC 请求接口
interface RpcRequest {
    jsonrpc: string;
    method: string;
    params: Record<string, any>;
    id: number;
}

// RPC 响应接口
interface RpcResponse {
    jsonrpc: string;
    result?: BalanceResult[];
    error?: {
        code: number;
        message: string;
    };
    id: number;
}

// BalanceResult 接口（基于 ccxt 返回的现货数据结构）
interface BalanceResult {
    accountId: string;
    exchangeResult: Record<string, { free: number; used: number; total: number }>;
}

// 钱包余额接口
interface WalletBalance {
    accountId: string;
    exchangeResult: Record<string, { free: number; used: number; total: number }>;
    updatedAt: Date;
    lastUpdateTime: Date;
}

@Injectable()
export class CexBalanceSyncService implements OnModuleInit {
    private readonly logger = new Logger(CexBalanceSyncService.name);
    private balanceCollection: Collection<WalletBalance>;

    constructor(private readonly mongoProvider: MongoProvider) {
        this.logger.log('BalanceSyncService constructed');
    }

    async onModuleInit() {
        this.logger.log('BalanceSyncService initializing...');
        this.balanceCollection = this.mongoProvider.getCollection<WalletBalance>('cex_wallet_balances'); // 表名改为 cex_wallet_balances
        await this.ensureIndexes();
        this.startSyncLoop();
    }

    private async ensureIndexes() {
        try {
            await this.balanceCollection.createIndex(
                { accountId: 1 },
                { unique: true }
            );

            await this.balanceCollection.createIndex({ updatedAt: 1 });

            this.logger.log('Indexes created successfully');
        } catch (error) {
            this.logger.error('Failed to create indexes:', error);
        }
    }

    private async startSyncLoop() {
        this.logger.log('Starting sync loop process');

        for (; ;) {
            try {
                await this.syncWalletBalances();
            } catch (error) {
                this.logger.error('Error in sync loop:', error);
            } finally {
                this.logger.log('Waiting for 3 minutes before next sync cycle...');
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
            }
        }
    }

    private async syncWalletBalances() {
        try {
            const balances = await this.fetchBalancesFromRpc();
            await this.saveWalletBalances(balances);
            this.logger.log(`Successfully synced ${balances.length} wallet balances`);
        } catch (error) {
            this.logger.error('Error syncing wallet balances:', error);
        }
    }

    private async fetchBalancesFromRpc(): Promise<BalanceResult[]> {
        const rpcRequest: RpcRequest = {
            jsonrpc: '2.0',
            method: 'fetchBalance',
            params: {},
            id: 1,
        };

        try {
            const response = await axios.post<RpcResponse>('http://127.0.0.1:18080/jsonrpc', rpcRequest, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            });

            if (response.data.error) {
                throw new Error(`RPC error: ${response.data.error.message}`);
            }

            if (!response.data.result || !Array.isArray(response.data.result)) {
                throw new Error('Invalid RPC response format');
            }

            return response.data.result;
        } catch (error) {
            this.logger.error('Failed to fetch balances from RPC:', error);
            throw error;
        }
    }

    private async saveWalletBalances(balances: BalanceResult[]) {
        const bulkOps = balances.map(balance => ({
            updateOne: {
                filter: { accountId: balance.accountId },
                update: {
                    $set: {
                        accountId: balance.accountId,
                        exchangeResult: balance.exchangeResult,
                        updatedAt: new Date(),
                        lastUpdateTime: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        try {
            const result = await this.balanceCollection.bulkWrite(bulkOps, { ordered: false });
            this.logger.log(`Updated ${result.modifiedCount} balances, Inserted ${result.upsertedCount} new records`);
        } catch (error) {
            this.logger.error('Failed to save wallet balances:', error);
            throw error;
        }
    }

    async getWalletBalance(accountId: string): Promise<WalletBalance | null> {
        try {
            return await this.balanceCollection.findOne({ accountId });
        } catch (error) {
            this.logger.error(`Failed to get balance for account ${accountId}:`, error);
            throw error;
        }
    }
}
