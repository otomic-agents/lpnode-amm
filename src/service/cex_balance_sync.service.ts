import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import axios from 'axios';
import { Collection } from 'mongodb';
import * as _ from "lodash";

// RPC request interface
interface RpcRequest {
    jsonrpc: string;
    method: string;
    params: Record<string, any>;
    id: number;
}

// RPC response interface
interface RpcResponse<T = any> {
    jsonrpc: string;
    result?: T;
    error?: {
        code: number;
        message: string;
    };
    id: number;
}

// BalanceResult interface
interface BalanceResult {
    accountId: string;
    exchangeResult: {
        info: {
            makerCommission: string;
            takerCommission: string;
            buyerCommission: string;
            sellerCommission: string;
            commissionRates: {
                maker: string;
                taker: string;
                buyer: string;
                seller: string;
            };
            canTrade: boolean;
            canWithdraw: boolean;
            canDeposit: boolean;
            brokered: boolean;
            requireSelfTradePrevention: boolean;
            preventSor: boolean;
            updateTime: string;
            accountType: string;
        };
        balances: {
            asset: string;
            free: string;
            locked: string;
        }[];
    };
}

// Wallet balance interface
interface WalletBalance {
    accountId: string;
    exchangeResult: {
        info: {
            makerCommission: string;
            takerCommission: string;
            buyerCommission: string;
            sellerCommission: string;
            commissionRates: {
                maker: string;
                taker: string;
                buyer: string;
                seller: string;
            };
            canTrade: boolean;
            canWithdraw: boolean;
            canDeposit: boolean;
            brokered: boolean;
            requireSelfTradePrevention: boolean;
            preventSor: boolean;
            updateTime: string;
            accountType: string;
        };
        balances: {
            asset: string;
            free: string;
            locked: string;
        }[];
    };
    updatedAt: Date;
    lastUpdateTime: Date;
}

@Injectable()
export class CexBalanceSyncService implements OnModuleInit {
    private readonly logger = new Logger(CexBalanceSyncService.name);
    private balanceCollection: Collection<WalletBalance>;
    private readonly rpcUrl: string;

    constructor(private readonly mongoProvider: MongoProvider) {
        const host = _.get(process.env, "LP_MARKET_SERVICE_HOST", "");
        const port = _.get(process.env, "LP_MARKET_SERVICE_PORT", "18080");
        this.rpcUrl = `http://${host}:${port}/jsonrpc`;
        this.logger.log('BalanceSyncService constructed', this.rpcUrl);
    }

    async onModuleInit() {
        this.logger.log('BalanceSyncService initializing...');
        this.balanceCollection = this.mongoProvider.getCollection<WalletBalance>('cex_wallet_balances');
        await this.ensureIndexes();
        this.startSyncLoop();
    }

    private async callRpc<T>(method: string, params: Record<string, any> = {}): Promise<T> {
        const rpcRequest: RpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id: 1,
        };

        try {
            this.logger.log(`Calling RPC method: ${method}`);
            const response = await axios.post<RpcResponse<T>>(this.rpcUrl, rpcRequest, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            });

            if (response.data.error) {
                throw new Error(`RPC error: ${response.data.error.message}`);
            }

            if (response.data.result === undefined) {
                throw new Error('Invalid RPC response format: result is missing');
            }

            return response.data.result;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(`Axios error in ${method}:`, {
                    message: error.message,
                    code: error.code,
                    response: error.response?.data
                });
            } else {
                this.logger.error(`Failed to execute ${method}:`, error);
            }
            throw error;
        }
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
                const isHedgingEnabled = await this.checkHedgingEnabled();

                if (!isHedgingEnabled) {
                    this.logger.log('Hedging is disabled, skipping sync cycle');
                    await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
                    continue;
                }
                await this.syncWalletBalances();
            } catch (error) {
                this.logger.error('Error in sync loop:', error);
            } finally {
                this.logger.log('Waiting for 3 minutes before next sync cycle...');
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
            }
        }
    }

    private async checkHedgingEnabled(): Promise<boolean> {
        try {
            const result = await this.callRpc<boolean>('isHedgingEnabled');
            return !!result;
        } catch (error) {
            this.logger.error('Failed to check hedging status:', error);
            return false;
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
        try {
            const result = await this.callRpc<BalanceResult>('fetchBalance');
            return [result];
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