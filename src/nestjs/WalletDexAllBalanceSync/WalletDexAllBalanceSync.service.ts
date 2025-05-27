import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import axios from 'axios';
import { Collection } from 'mongodb';
import * as _ from "lodash";
import { ethers } from 'ethers';

// Wallet interface
interface Wallet {
    _id: { $oid: string };
    walletName: string;
    privateKey: string;
    address: string;
    addressLower: string;
    chainType: string;
    chainId: number;
    accountId: string;
    storeId: string;
    walletType: string;
    vaultHostType: string;
    vaultName: string;
    vaultSecertType: string;
    signServiceEndpoint: string;
}

// Wallet address chain group interface
interface WalletAddressChainGroup {
    address: string;
    chainType: string;
    chainId: number;
    walletNames: string[];
}

// Token info interface
interface TokenInfo {
    _id?: any;
    address: string;
    addressIndex?: string;
    chainId: number;
    chainType: string;
    coinType?: string;
    marketName: string;
    precision: number;
    tokenName: string;
}

// Token balance response
interface TokenBalanceResponse {
    address: string;
    tokenAddress: string;
    balance: string;
}

// Wallet balance record stored in MongoDB
interface WalletBalanceRecord {
    _id?: any;
    walletAddress: string;
    chainType: string;
    chainId: number;
    walletNames: string[];
    tokenAddress: string;
    balance: string;
    decimals: number;
    symbol?: string;
    formattedBalance?: string;
    updatedAt: Date;
}

// RPC request interface
interface RpcRequest {
    jsonrpc: string;
    method: string;
    params: any[];
    id: number | string;
}

// RPC response interface
interface RpcResponse<T = any> {
    jsonrpc: string;
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id: number | string;
}

// Chain info interface
interface ChainInfo {
    _id: any;
    chainId: number;
    chainName: string;
    chainType: string;
    envList?: any[];
    image?: string;
    name: string;
    precision: number;
    rpcTx?: string;
    serviceName: string; // Used to build RPC URL
    tokenName: string;
    tokenUsd?: number;
    deployName?: string;
}

@Injectable()
export class WalletDexAllBalanceSyncService implements OnModuleInit {
    private readonly logger = new Logger(WalletDexAllBalanceSyncService.name);
    private walletCollection: Collection<Wallet>;
    private balanceCollection: Collection<WalletBalanceRecord>;
    private tokensCollection: Collection<TokenInfo>;
    private chainListCollection: Collection<ChainInfo>;

    // Fixed RPC service port
    private readonly RPC_PORT = 9100;

    constructor(private readonly mongoProvider: MongoProvider) {
        this.logger.log(`WalletDexAllBalanceSyncService constructed, fixed RPC port: ${this.RPC_PORT}`);
    }

    async onModuleInit() {
        this.logger.log('WalletDexAllBalanceSyncService initializing...');
        try {
            // Initialize collection references
            this.walletCollection = this.mongoProvider.getCollection<Wallet>('wallets');
            this.balanceCollection = this.mongoProvider.getCollection<WalletBalanceRecord>('wallet_dex_all_balances');
            this.tokensCollection = this.mongoProvider.getCollection<TokenInfo>('tokens');
            this.chainListCollection = this.mongoProvider.getCollection<ChainInfo>('chainList');

            // Ensure indexes exist
            await this.ensureIndexes();

            // Start sync loop
            this.startSyncLoop();
            this.logger.log('WalletDexAllBalanceSyncService initialization complete');
        } catch (error) {
            this.logger.error('WalletDexAllBalanceSyncService initialization failed:', error);
        }
    }

    private async ensureIndexes() {
        try {
            // Balance collection indexes
            await this.balanceCollection.createIndex(
                { walletAddress: 1, chainId: 1, tokenAddress: 1 },
                { unique: true }
            );
            await this.balanceCollection.createIndex({ walletNames: 1 });
            await this.balanceCollection.createIndex({ chainType: 1, chainId: 1 });
            await this.balanceCollection.createIndex({ updatedAt: 1 });

            // Token collection indexes
            await this.tokensCollection.createIndex({ chainId: 1, address: 1 });

            // Chain list collection indexes
            await this.chainListCollection.createIndex({ chainId: 1 }, { unique: true });

            this.logger.log('Database indexes created successfully');
        } catch (error) {
            this.logger.error('Failed to create indexes:', error);
        }
    }

    // Start sync loop
    private async startSyncLoop() {
        this.logger.log('Starting wallet balance sync loop');
        const syncIntervalMinutes = 5; // Sync interval (minutes)
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                this.logger.log('Starting new sync cycle');
                await this.syncWalletBalances();
                this.logger.log('Sync cycle completed successfully');
            } catch (error) {
                this.logger.error('Error in wallet balance sync loop:', error);
            } finally {
                this.logger.log(`Waiting ${syncIntervalMinutes} minutes before next sync...`);
                await new Promise(resolve => setTimeout(resolve, syncIntervalMinutes * 60 * 1000));
            }
        }
    }

    // Sync all wallet balances
    private async syncWalletBalances() {
        try {
            const addressChainGroups = await this.getWalletAddressChainGroups();
            this.logger.log(`Found ${addressChainGroups.length} wallet address/chain combinations to sync`);

            // Process all groups concurrently
            const syncPromises = addressChainGroups.map(group =>
                this.syncAddressTokenBalances(group).catch(err => {
                    this.logger.error(`Failed to sync group ${group.address}/${group.chainId}:`, err);
                    return null;
                })
            );

            await Promise.allSettled(syncPromises);
            this.logger.log('All wallet address/chain combinations synced');
        } catch (error) {
            this.logger.error('Error during wallet balance sync process:', error);
        }
    }

    // Get all token addresses for a specific chain
    private async getTokenAddressesForChain(chainId: number): Promise<string[]> {
        try {
            const tokens = await this.tokensCollection.find({ chainId }).toArray();
            return tokens.map(token => token.address);
        } catch (error) {
            this.logger.error(`Failed to get token addresses for chain ${chainId}:`, error);
            return [];
        }
    }

    // Get token info
    private async getTokenInfo(chainId: number, tokenAddress: string): Promise<TokenInfo | null> {
        try {
            return await this.tokensCollection.findOne({
                chainId,
                address: tokenAddress
            });
        } catch (error) {
            this.logger.error(`Failed to get token info: chainId=${chainId}, tokenAddress=${tokenAddress}`, error);
            return null;
        }
    }

    // Get chain info
    private async getChainInfo(chainId: number): Promise<ChainInfo | null> {
        try {
            return await this.chainListCollection.findOne({ chainId });
        } catch (error) {
            this.logger.error(`Failed to get chain info: chainId=${chainId}`, error);
            return null;
        }
    }

    // Sync all token balances for a single address/chain combination
    private async syncAddressTokenBalances(group: WalletAddressChainGroup) {
        const { address, chainId, chainType, walletNames } = group;
        this.logger.log(`Syncing address: ${address}, chainId: ${chainId} (${chainType}), wallets: [${walletNames.join(', ')}]`);

        // Get chain info to build RPC URL
        const chainInfo = await this.getChainInfo(chainId);
        if (!chainInfo) {
            this.logger.error(`Cannot sync balances for chainId ${chainId}: chain configuration not found`);
            return;
        }

        if (!chainInfo.serviceName) {
            this.logger.error(`Cannot sync balances for chainId ${chainId}: serviceName missing in chain configuration`);
            return;
        }

        // Build chain-specific RPC URL using serviceName and fixed port
        const targetRpcUrl = `http://${chainInfo.serviceName}:${this.RPC_PORT}/rpc`;
        this.logger.debug(`Using RPC URL: ${targetRpcUrl}`);

        // Get all token addresses for this chain
        const tokenAddresses = await this.getTokenAddressesForChain(chainId);
        if (tokenAddresses.length === 0) {
            this.logger.warn(`No tokens found for chainId ${chainId}. Skipping balance check for ${address}`);
            return;
        }

        // Get all token balances concurrently
        const balancePromises = tokenAddresses.map(async (tokenAddress) => {
            try {
                const balanceResponse = await this.callRpcGetWalletBalances(
                    targetRpcUrl,
                    address,
                    tokenAddress,
                    chainId
                );

                if (balanceResponse) {
                    await this.saveWalletBalance(group, balanceResponse);
                }
            } catch (tokenError) {
                this.logger.error(`Failed to get/save balance for token ${tokenAddress} on chain ${chainId} for address ${address}:`, tokenError);
            }
        });

        await Promise.allSettled(balancePromises);
        this.logger.log(`Completed syncing all tokens for address: ${address}, chainId: ${chainId}`);
    }

    // Call RPC to get wallet balances
    private async callRpcGetWalletBalances(
        rpcUrl: string,
        walletAddress: string,
        tokenAddress: string,
        chainId: number
    ): Promise<TokenBalanceResponse | null> {
        const rpcRequest: RpcRequest = {
            jsonrpc: '2.0',
            method: 'getWalletBalances',
            params: [walletAddress, tokenAddress],
            id: `${chainId}-${Date.now()}`,
        };

        try {
            const response = await axios.post<RpcResponse<TokenBalanceResponse>>(rpcUrl, rpcRequest, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000, // 30 seconds timeout
            });

            if (response.data.error) {
                this.logger.error(`RPC error (chain ${chainId}): ${response.data.error.message}`);
                return null;
            }

            return response.data.result || null;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.logger.error(`Axios error calling RPC ${rpcUrl}:`, {
                    message: error.message,
                    code: error.code,
                    response: error.response?.data
                });
            } else {
                this.logger.error(`General error calling RPC ${rpcUrl}:`, error);
            }
            return null;
        }
    }

    // Save wallet balance to database
    private async saveWalletBalance(
        group: WalletAddressChainGroup,
        balanceResponse: TokenBalanceResponse
    ): Promise<void> {
        try {
            const { address, chainId, chainType, walletNames } = group;
            const { tokenAddress, balance } = balanceResponse;

            // Get token info for precision and symbol
            const tokenInfo = await this.getTokenInfo(chainId, tokenAddress);
            if (!tokenInfo) {
                this.logger.warn(`Token info not found: chainId=${chainId}, tokenAddress=${tokenAddress}`);
                return;
            }

            // Format balance using token precision
            const decimals = tokenInfo.precision;
            const formattedBalance = this.formatBalance(balance, decimals);

            const balanceRecord: Partial<WalletBalanceRecord> = {
                walletAddress: address, // Keep original case
                chainType,
                chainId,
                walletNames,
                tokenAddress: tokenAddress, // Keep original case
                balance,
                decimals,
                symbol: tokenInfo.tokenName,
                formattedBalance,
                updatedAt: new Date()
            };

            // Use upsert operation to update or insert record
            await this.balanceCollection.updateOne(
                {
                    walletAddress: balanceRecord.walletAddress,
                    chainId: balanceRecord.chainId,
                    tokenAddress: balanceRecord.tokenAddress
                },
                { $set: balanceRecord },
                { upsert: true }
            );

            // this.logger.debug(`Balance saved: ${address}, chainId: ${chainId}, token: ${tokenAddress}, balance: ${formattedBalance} ${tokenInfo.marketName}`);
        } catch (error) {
            this.logger.error(`Failed to save wallet balance:`, error);
            throw error; // Rethrow for caller to handle
        }
    }


    // Format balance considering token precision
    private formatBalance(balanceStr: string, decimals: number): string {
        try {
            // Use ethers.js v6 to handle big numbers
            const balance = ethers.getBigInt(balanceStr);
            const divisor = ethers.getBigInt(10) ** BigInt(decimals);

            // Convert to floating point string with appropriate decimal places
            const beforeDecimal = (balance / divisor).toString();
            const afterDecimal = (balance % divisor).toString().padStart(decimals, '0');

            // Remove trailing zeros
            const trimmedAfterDecimal = afterDecimal.replace(/0+$/, '');

            if (trimmedAfterDecimal.length > 0) {
                return `${beforeDecimal}.${trimmedAfterDecimal}`;
            } 
            return beforeDecimal;
            
        } catch (error) {
            this.logger.error(`Failed to format balance: ${balanceStr}, precision: ${decimals}`, error);
            return balanceStr; // Return original string on error
        }
    }

    // Get all wallet address/chain combinations that need to be synced
    private async getWalletAddressChainGroups(): Promise<WalletAddressChainGroup[]> {
        try {
            // Aggregation query, group by address and chainId
            const pipeline = [
                {
                    $group: {
                        _id: {
                            address: "$address", // Keep original case
                            chainId: "$chainId",
                            chainType: "$chainType"
                        },
                        walletNames: { $addToSet: "$walletName" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        address: "$_id.address",
                        chainId: "$_id.chainId",
                        chainType: "$_id.chainType",
                        walletNames: 1
                    }
                }
            ];

            const groups = await this.walletCollection.aggregate(pipeline).toArray();
            return groups as WalletAddressChainGroup[];
        } catch (error) {
            this.logger.error('Failed to get wallet address/chain groups:', error);
            return []; // Return empty array on error
        }
    }
}
