import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import { AmmDatabaseContext } from '../../interface/amm_database_context';
import { Collection } from 'mongodb';
import * as _ from "lodash"
import { CalculateProcessBase } from './calculate_process_base';
@Injectable()
export class CalculateBaseService extends CalculateProcessBase {
    private readonly logger = new Logger(CalculateBaseService.name);
    @Inject()
    private readonly mongoProvider: MongoProvider;
    public async process() {
        for (; ;) {
            const list: AmmDatabaseContext[] = await this.findResult();
            this.logger.debug(`base process list length:${list.length}`)
            for (const row of list) {
                await this.processRow(row)
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    private async findResult() {
        const ammContextCollect: Collection<AmmDatabaseContext> = this.mongoProvider.getCollection<AmmDatabaseContext>('ammContext_amm-01');
        return await ammContextCollect.find({
            baseProcessed: false,
            hasTransaction: true,
            transactionCompleted: false,
        }).sort({ _id: 1 }).toArray()
    }

    private async processRow(row: AmmDatabaseContext) {
        // const transactionType = this.getSwapType(row);
        await this.processStatus(row);

    }
    private async processStatus(row: AmmDatabaseContext) {
        if (this.isTransactionCompleted(row)) {
            const ammContextCollect: Collection<AmmDatabaseContext> = this.mongoProvider.getCollection<AmmDatabaseContext>('ammContext_amm-01');
            let findOption = {
                "_id": row._id
            }
            ammContextCollect.findOneAndUpdate(
                findOption, {
                $set: {
                    transactionCompleted: true,
                    baseProcessed: true
                }
            }
            )
            return
        }
        this.logger.log("skip", "-------------------")
    }
}