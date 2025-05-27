import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import axios from 'axios';
import { Collection, ObjectId } from 'mongodb';
import * as _ from "lodash";
import { GlobalStatus } from '../../global_status';

// CEX Account interface
interface CexAccount {
    _id: string | ObjectId;
    name: string;
    exchange: string;
    api_key: string;
    api_secret: string;
    passphrase?: string;
    status: string;
    created_at: Date;
    updated_at: Date;
}

// RPC request interface
interface RpcRequest {
    jsonrpc: string;
    method: string;
    params: any;
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

// Balance result interface
interface BalanceResult {
    accountId: string;
    accountName: string; // Added account name field
    exchange: string;
    exchangeResult: {
        info: any;
        balances: {
            asset: string;
            free: string;
            locked: string;
            total?: string;
        }[];
    };
}

// Wallet balance interface
interface WalletBalance {
    accountId: string;
    exchange: string;
    name: string;
    exchangeResult: {
        info: any;
        balances: {
            asset: string;
            free: string;
            locked: string;
            total?: string;
        }[];
    };
    updatedAt: Date;
    lastUpdateTime: Date;
}

// New RPC return result interface
interface SpotBalanceResult {
    account: string;
    exchange: string;
    timestamp: string;
    balance: {
        symbol: string;
        free: number;
        used: number;
        total: number;
    }[];
}

@Injectable()
export class WalletCexAllBalanceSyncService implements OnModuleInit {
    private readonly logger = new Logger(WalletCexAllBalanceSyncService.name);
    private balanceCollection: Collection<WalletBalance>;
    private accountsCollection: Collection<CexAccount>;
    private readonly rpcUrl: string = 'http://amm-market-price-service:18080/jsonrpc';

    constructor(private readonly mongoProvider: MongoProvider) {
        this.logger.log('WalletCexAllBalanceSyncService constructed with RPC URL:', this.rpcUrl);
    }

    async onModuleInit() {
        this.logger.log('WalletCexAllBalanceSyncService initializing...');
        this.balanceCollection = this.mongoProvider.getCollection<WalletBalance>('cex_wallet_balances');
        this.accountsCollection = this.mongoProvider.getCollection<CexAccount>('cex_accounts');
        await this.ensureIndexes();
        this.startSyncLoop();
    }

    private async callRpc<T>(method: string, params: any = {}): Promise<T> {
        const rpcRequest: RpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id: 1,
        };

        try {
            this.logger.log(`Calling RPC method: ${method} with params: ${JSON.stringify(params)}`);
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
        this.logger.log('Starting sync loop process for all CEX accounts');

        for (; ;) {
            try {
                await this.syncAllCexWalletBalances();
            } catch (error) {
                this.logger.error('Error in sync loop:', error);
            } finally {
                this.logger.log('Waiting for 3 minutes before next sync cycle...');
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
            }
        }
    }

    private async syncAllCexWalletBalances() {
        try {
            // Get all active CEX accounts
            const accounts = await this.accountsCollection.find({ status: 'active' }).toArray();
            this.logger.log(`Found ${accounts.length} active CEX accounts to sync`);

            if (accounts.length === 0) {
                this.logger.log('No active CEX accounts found, skipping sync');
                return;
            }

            // Track successful and failed account counts
            let successCount = 0;
            let failureCount = 0;
            const accountNames: string[] = [];
            for (const account of accounts) {
                this.logger.log(`Syncing balance for account: ${account.name} (${account._id})`);
                accountNames.push(account.name);
                GlobalStatus.statusReportService.setCexAccounts(accountNames);
            }
            // Process each account
            for (const account of accounts) {
                try {
                    this.logger.log(`Syncing balance for account: ${account.name} (${account._id})`);

                    // Get balance directly from RPC
                    const result = await this.callRpc<SpotBalanceResult>('getSpotBalances', [account._id.toString()]);

                    // Save directly to database, no need to go through fetchBalanceForAccount
                    await this.saveBalanceDirectly(account, result);

                    successCount++;
                } catch (error) {
                    this.logger.error(`Failed to sync balance for account ${account.name} (${account._id}):`, error);
                    failureCount++;
                    // Continue processing the next one even if one fails
                }
            }
            //   

            this.logger.log(`Sync cycle completed: ${successCount} accounts succeeded, ${failureCount} accounts failed`);
        } catch (error) {
            this.logger.error('Error syncing all wallet balances:', error);
        }
    }

    // New method: directly save RPC returned balance data
    private async saveBalanceDirectly(account: CexAccount, result: SpotBalanceResult) {
        try {
            const now = new Date();

            // Convert balance format
            const balances = result.balance.map(item => ({
                asset: item.symbol,
                free: String(item.free),
                locked: String(item.used),
                total: String(item.total)
            }));

            // Prepare data to save
            const walletBalance: Partial<WalletBalance> = {
                accountId: account._id.toString(),
                exchange: account.exchange,
                name: account.name,
                exchangeResult: {
                    info: {
                        timestamp: result.timestamp,
                        exchange: result.exchange,
                        account: result.account
                    },
                    balances: balances
                },
                updatedAt: now,
                lastUpdateTime: now
            };

            // Save to database
            const updateResult = await this.balanceCollection.updateOne(
                { accountId: account._id.toString() },
                { $set: walletBalance },
                { upsert: true }
            );

            this.logger.log(`Updated balance for account ${account.name}: ${updateResult.modifiedCount} modified, ${updateResult.upsertedCount} upserted`);
        } catch (error) {
            this.logger.error(`Failed to save balance for account ${account.name}:`, error);
            throw error;
        }
    }

    // The following methods remain unchanged
    async getWalletBalance(accountId: string): Promise<WalletBalance | null> {
        try {
            return await this.balanceCollection.findOne({ accountId });
        } catch (error) {
            this.logger.error(`Failed to get balance for account ${accountId}:`, error);
            throw error;
        }
    }

    async getAllWalletBalances(): Promise<WalletBalance[]> {
        try {
            return await this.balanceCollection.find().toArray();
        } catch (error) {
            this.logger.error('Failed to get all wallet balances:', error);
            throw error;
        }
    }

    // Manually trigger synchronization for a specific account
    async syncAccountBalanceById(accountId: string): Promise<WalletBalance | null> {
        try {
            const account = await this.accountsCollection.findOne({
                _id: new ObjectId(accountId)
            });

            if (!account) {
                throw new Error(`Account not found with ID: ${accountId}`);
            }

            if (account.status !== 'active') {
                throw new Error(`Account ${account.name} (${accountId}) is not active`);
            }

            // Get balance directly from RPC
            const result = await this.callRpc<SpotBalanceResult>('getSpotBalances', [account.name]);

            // Save balance
            await this.saveBalanceDirectly(account, result);

            return this.getWalletBalance(accountId);
        } catch (error) {
            this.logger.error(`Failed to manually sync balance for account ${accountId}:`, error);
            throw error;
        }
    }
}
