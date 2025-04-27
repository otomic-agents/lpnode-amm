import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import { CalculateProcessBase } from "./calculate_process_base";
import { Collection } from 'mongodb';
import { AmmDatabaseContext } from '../../interface/amm_database_context';
import { ObjectId } from 'mongodb';

enum ChainType {
    EVM = 'evm',
    SOLANA = 'solana',
    UNKNOWN = 'unknown'
}

const CHAIN_MAP = {
    '9006': 'BSC',
    '501': 'Solana',
    '60': 'Ethereum',
    '614': 'Optimism'
};

export class CalculateSwapService extends CalculateProcessBase {
    private readonly logger = new Logger(CalculateSwapService.name);
    @Inject()
    private readonly mongoProvider: MongoProvider;
    private collection: Collection<AmmDatabaseContext>;

    private readonly evmChainIds = [9006, 60, 614];
    private readonly solanaChainIds = [501];

    public async process() {
        this.collection = this.mongoProvider.getCollection<AmmDatabaseContext>('ammContext_amm-01');
        for (; ;) {
            const list: AmmDatabaseContext[] = await this.findResult();
            this.logger.debug(`CalculateSwap process list length:${list.length}`)
            for (const row of list) {
                await this.processRow(row)
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    private async findResult() {
        return await this.collection.find({
            baseProcessed: true,
            hasTransaction: true,
            transactionCompleted: true,
            $or: [
                { swapProcessed: false },
                { swapProcessed: { $exists: false } }
            ]
        }).sort({ _id: 1 }).toArray()
    }

    private async processRow(row: AmmDatabaseContext) {
        const transactionType = this.getSwapType(row);
        if (transactionType === "atomic") {
            await this.processAtomic(row);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (transactionType === "singleSwap") {
            await this.processSingleSwap(row);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    private async processAtomic(row: AmmDatabaseContext) {
        try {
            this.logger.debug(`Processing atomic swap for context: ${row._id}`);
            const swapResult = this.initializeSwapResult(row);

            this.processTransactionInfo(row, swapResult, 'dexTradeInfo_in', 'in');
            this.processTransactionInfo(row, swapResult, 'dexTradeInfo_in_confirm', 'in_confirm');

            await this.updateSwapResult(row._id, swapResult);

            this.logger.debug(`Successfully processed atomic swap for context: ${row._id}`);
            return swapResult;
        } catch (error) {
            this.logger.error(`Error processing atomic swap for context: ${row._id}`, error);
            throw error;
        }
    }
    private async processSingleSwap(row: AmmDatabaseContext) {
        try {
            this.logger.debug(`Processing atomic swap for context: ${row._id}`);
            const swapResult = this.initializeSwapResult(row);

            this.processTransactionInfo(row, swapResult, 'dexTradeInfo_confirm_swap', 'confirm_swap');
            // this.processTransactionInfo(row, swapResult, 'dexTradeInfo_refund_swap', 'in_confirm');

            await this.updateSwapResult(row._id, swapResult);

            this.logger.debug(`Successfully processed atomic swap for context: ${row._id}`);
            return swapResult;
        } catch (error) {
            this.logger.error(`Error processing atomic swap for context: ${row._id}`, error);
            throw error;
        }
    }


    private initializeSwapResult(row: AmmDatabaseContext): any {
        const baseInfo = this.parseJsonField(row.baseInfo);
        const dstChain = this.parseJsonField(baseInfo.dstChain);

        return {
            gas: {
                symbol: dstChain.nativeTokenName || 'UNKNOWN',
                gasTotal: 0,
                gasUSDTotal: 0,
                transaction: []
            }
        };
    }

    private processTransactionInfo(row: AmmDatabaseContext, swapResult: any, fieldName: string, eventType: string): void {
        //@ts-ignore
        if (!row[fieldName]) {
            this.logger.log(`${fieldName} not found for context: ${row._id}`);
            return;
        }

        try {
            //@ts-ignore
            const tradeInfo = this.parseJsonField(row[fieldName]);
            const rawData = this.parseJsonField(tradeInfo.rawData);

            if (!rawData.transfer_info) {
                this.logger.warn(`transfer_info missing in ${fieldName} for context: ${row._id}`);
                return;
            }

            const transferInfo = this.parseJsonField(rawData.transfer_info);
            this.logger.debug(`TransferInfo for ${fieldName}: ${JSON.stringify(transferInfo)}`);

            // get dst chain info
            const baseInfo = this.parseJsonField(row.baseInfo);
            const dstChain = this.parseJsonField(baseInfo.dstChain);
            const chainId = dstChain.id || 0;
            const nativeTokenPrecision = dstChain.nativeTokenPrecision;

            const chainType = this.getChainType(chainId);
            this.logger.debug(`Chain ID: ${chainId} ${typeof (chainId)}, Chain Type: ${chainType}`);

            const quoteInfo = this.parseJsonField(row.quoteInfo);
            const nativeTokenUsdtPrice = parseFloat(quoteInfo.native_token_usdt_price) || 0;

            const { actualGas, gasUSD } = this.calculateGasFee(
                transferInfo,
                chainType,
                chainId,
                nativeTokenUsdtPrice,
                nativeTokenPrecision
            );

            swapResult.gas.transaction.push({
                event: eventType,
                gas: actualGas,
                gasUSD: gasUSD
            });

            swapResult.gas.gasTotal += actualGas;
            swapResult.gas.gasUSDTotal += gasUSD;

            this.logger.debug(`Processed ${fieldName} for chain ${chainId}: gas=${actualGas}, gasUSD=${gasUSD}`);
        } catch (error) {
            this.logger.error(`Error processing ${fieldName} for context: ${row._id}`, error);
            swapResult.gas.transaction.push({
                event: eventType,
                gas: 0,
                gasUSD: 0
            });
        }
    }

    private getChainType(chainId: number): ChainType {
        if (this.evmChainIds.includes(chainId)) {
            return ChainType.EVM;
        } else if (this.solanaChainIds.includes(chainId)) {
            return ChainType.SOLANA;
        }
        return ChainType.UNKNOWN;
    }

    private calculateGasFee(
        transferInfo: any,
        chainType: ChainType,
        chainId: number,
        nativeTokenUsdtPrice: number,
        nativeTokenPrecision: number
    ): { actualGas: number, gasUSD: number } {
        let actualGas = 0;

        switch (chainType) {
            case ChainType.EVM:
                actualGas = this.calculateEvmGasFee(transferInfo, chainId, nativeTokenPrecision);
                break;
            case ChainType.SOLANA:
                actualGas = this.calculateSolanaGasFee(transferInfo, nativeTokenPrecision);
                break;
            default:
                this.logger.warn(`Unknown chain type: ${chainType}, using default gas calculation`);
        }

        const gasUSD = actualGas * nativeTokenUsdtPrice;

        return { actualGas, gasUSD };
    }

    private calculateEvmGasFee(transferInfo: any, chainId: number, nativeTokenPrecision: number): number {
        const gasUsed = transferInfo.gasUsed || "0";
        const gasPrice = transferInfo.gasPrice || transferInfo.effectiveGasPrice || "0";
        this.logger.debug(`EVM gas calculation - gasUsed: ${gasUsed}, gasPrice: ${gasPrice}`);
        const gasUsedValue = this.convertToDecimal(gasUsed, 0);
        const gasPriceValue = this.convertToDecimal(gasPrice, nativeTokenPrecision);
        this.logger.debug(`EVM converted values - gasUsedValue: ${gasUsedValue}, gasPriceValue: ${gasPriceValue}`);
        return gasUsedValue * gasPriceValue;
    }

    private calculateSolanaGasFee(transferInfo: any, nativeTokenPrecision: number): number {
        const lamports = transferInfo.lamports || transferInfo.fee || transferInfo.gasUsed || "0";
        this.logger.debug(`Solana gas calculation - lamports/fee: ${lamports}`);

        // (1 SOL = 10^9 lamports)
        const solanaDecimals = nativeTokenPrecision // 9;
        return this.convertToDecimal(lamports, solanaDecimals);
    }

    private convertToDecimal(value: string | number, precision: number): number {
        if (value === undefined || value === null) {
            return 0;
        }

        if (typeof value === 'number') {
            return value / Math.pow(10, precision);
        }

        if (typeof value === 'string' && value.toLowerCase().startsWith('0x')) {
            try {
                const numericValue = parseInt(value, 16);
                return numericValue / Math.pow(10, precision);
            } catch (e) {
                this.logger.error(`Failed to parse hex string: ${value}`);
                return 0;
            }
        }

        try {
            const parsed = parseFloat(value);
            if (isNaN(parsed)) {
                return 0;
            }
            return parsed / Math.pow(10, precision);
        } catch (e) {
            this.logger.error(`Failed to parse string: ${value}`);
            return 0;
        }
    }

    private parseJsonField(field: any): any {
        if (!field) return {};
        if (typeof field === 'string') {
            try {
                return JSON.parse(field);
            } catch (error) {
                this.logger.warn(`Failed to parse JSON string: ${field.substring(0, 100)}...`);
                return {};
            }
        }
        return field;
    }

    private async updateSwapResult(id: ObjectId, swapResult: any): Promise<void> {
        this.logger.debug(`Final swap result:`, swapResult);
        await this.collection.updateOne(
            { _id: id },
            {
                $set: {
                    swapResult: swapResult,
                    swapProcessed: true,
                    swapProcessedTime: new Date().getTime()
                }
            }
        );
    }
}
