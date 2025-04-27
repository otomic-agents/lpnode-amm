import { Injectable, Inject,Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import axios from 'axios';
import { Collection } from 'mongodb';

// Chain information interface
interface ChainInfo {
    _id: string;
    chainId: number;
    chainName: string;
    chainType: string;
    serviceName: string;
    deployName: string;
    envList: Array<{ STATUS_KEY: string }>;
    image: string;
    name: string;
    precision: number;
    rpcTx: string;
    tokenName: string;
    tokenUsd: number;
}

// API response data interface
interface WalletBalanceApiResponse {
    wallet_name: string;
    token: string;
    wallet_address: string;
    decimals: number;
    balance_value: {
        type: string;
        hex: string;
    };
}

// Database stored wallet balance interface
interface WalletBalance {
    wallet_name: string;
    token: string;
    wallet_address: string;
    decimals: number;
    balance_value: {
        type: string;
        hex: string;
    };
    chainId: number;
    chainName: string;
    updatedAt: Date;
    lastUpdateTime: Date;
}

// API response interface
interface ApiResponse {
    code: number;
    data: WalletBalanceApiResponse[];
}

@Injectable()
export class DexWalletBalanceSyncService implements OnModuleInit {
    private readonly logger = new Logger(DexWalletBalanceSyncService.name);
    private balanceCollection: Collection<WalletBalance>;

    @Inject()
    private readonly mongoProvider: MongoProvider;

    async onModuleInit() {
        this.logger.log('WalletBalanceService initializing...');
        this.balanceCollection = this.mongoProvider.getCollection<WalletBalance>('wallet_balances');
        await this.ensureIndexes();
        this.startUpdateLoop();
    }

    private async ensureIndexes() {
        try {
            await this.balanceCollection.createIndex(
                {
                    wallet_address: 1,
                    token: 1,
                    chainId: 1
                },
                { unique: true }
            );
     
            await this.balanceCollection.createIndex({ chainId: 1 });
            await this.balanceCollection.createIndex({ 
                updatedAt: 1 
            }, {
                expireAfterSeconds: 600
            });
            await this.balanceCollection.createIndex({ wallet_address: 1 });
     
            this.logger.log('Indexes created successfully');
        } catch (error) {
            this.logger.error('Failed to create indexes:', error);
        }
     }

    private async startUpdateLoop() {
        this.logger.log('Starting update loop process');

        for (; ;) {
            try {
                await this.updateWalletBalances();
            } catch (error) {
                this.logger.error('Error in main update loop:', error);
            } finally {
                this.logger.log('Waiting for 3 minutes before next update cycle...');
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
            }
        }
    }

    private async updateWalletBalances() {
        const chains = await this.getChainList();
        this.logger.log(`Found ${chains.length} total chains`);

        // Process chains serially, error in one chain won't affect others
        for (const chain of chains) {
            try {
                this.logger.log(`Processing chain: ${chain.chainName} (${chain.chainId}) - Type: ${chain.chainType}`);
                await this.updateChainWalletBalances(chain);
                this.logger.log(`Successfully processed chain: ${chain.chainName}`);
            } catch (error) {
                this.logger.error(`Error processing chain ${chain.chainName} (${chain.chainId}):`, error);
                // Continue to process next chain
                continue;
            }
        }
    }

    private async getChainList(): Promise<ChainInfo[]> {
        const collection = this.mongoProvider.getCollection<ChainInfo>('chainList');
        return await collection.find({}).toArray();
    }

    private async updateChainWalletBalances(chain: ChainInfo) {
        try {
            const url = `http://${chain.serviceName}:9100/${chain.chainType}-client-${chain.chainId}/lpnode/get_wallets`;

            this.logger.log(`Fetching wallet balances from: ${url}`);

            const response = await axios.post<ApiResponse>(url, {}, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            if (response.data.code === 200 && Array.isArray(response.data.data)) {
                const balances: WalletBalance[] = response.data.data.map(balance => ({
                    ...balance,
                    chainId: chain.chainId,
                    chainName: chain.chainName,
                    updatedAt: new Date(),
                    lastUpdateTime: new Date()
                }));

                await this.saveWalletBalances(balances, chain);
                this.logger.log(`Successfully updated ${balances.length} balances for ${chain.chainName}`);
            } else {
                throw new Error(`Invalid response: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            this.logger.error(`Failed to update balances for chain ${chain.chainName}:`, error);
            throw error;
        }
    }

    private async saveWalletBalances(balances: WalletBalance[], chain: ChainInfo) {
        const bulkOps = balances.map(balance => ({
            updateOne: {
                filter: {
                    wallet_address: balance.wallet_address,
                    token: balance.token,
                    chainId: chain.chainId
                },
                update: { $set: balance },
                upsert: true
            }
        }));

        try {
            const result = await this.balanceCollection.bulkWrite(bulkOps, { ordered: false });
            this.logger.log(`Chain ${chain.chainName}: Updated ${result.modifiedCount} balances, Inserted ${result.upsertedCount} new records`);
        } catch (error) {
            this.logger.error(`Failed to save balances for chain ${chain.chainName}:`, error);
            throw error;
        }
    }

    async getWalletBalances(walletAddress: string): Promise<WalletBalance[]> {
        try {
            return await this.balanceCollection
                .find({ wallet_address: walletAddress })
                .sort({ chainId: 1, token: 1 })
                .toArray();
        } catch (error) {
            this.logger.error(`Failed to get balances for wallet ${walletAddress}:`, error);
            throw error;
        }
    }

    async getWalletBalancesByChain(walletAddress: string, chainId: number): Promise<WalletBalance[]> {
        try {
            return await this.balanceCollection
                .find({
                    wallet_address: walletAddress,
                    chainId: chainId
                })
                .sort({ token: 1 })
                .toArray();
        } catch (error) {
            this.logger.error(`Failed to get balances for wallet ${walletAddress} on chain ${chainId}:`, error);
            throw error;
        }
    }
}
