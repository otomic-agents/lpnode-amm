import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoProvider } from '../providers/database/mongo.provider';
import { Collection, ObjectId } from 'mongodb';
import { HedgeAccount, HedgeTask } from './interface';
import * as _ from "lodash";

import { ICexAccountApiType } from "../../interface/std_difi";
import { IHedgeConfig, IHedgeType } from '../../interface/interface';


@Injectable()
export class HedgeDataService implements OnModuleInit {
    private readonly logger = new Logger(HedgeDataService.name);
    private hedgeCollection: Collection<HedgeTask>;
    private hedgeAccountCollection: Collection<HedgeAccount>
    private readonly rpcUrl: string;
    public async getHedgeConfig(): Promise<IHedgeConfig> {
        const hedgeType = await this.getHedgeType();
        const formattedHedgeType = hedgeType === "SPOT" ? IHedgeType.CoinSpotHedge : IHedgeType.Null;
        return {
            hedgeType: formattedHedgeType,
            hedgeAccount: await this.getHedgeAccount(),
            feeSymbol: "USDT"
        }
    }
    constructor(private readonly mongoProvider: MongoProvider) {

        this.logger.log('HedgeDataService constructed', this.rpcUrl);
    }

    async onModuleInit() {
        this.hedgeCollection = this.mongoProvider.getCollection<HedgeTask>('hedge_tasks');
        this.hedgeAccountCollection = this.mongoProvider.getCollection<HedgeAccount>('cex_accounts');
    }
    async getHedgeTaskData(): Promise<void> {
        const appName = _.get(process.env, "APP_NAME", undefined)
        try {
            const result: HedgeTask[] = await this.hedgeCollection.find({ amm_name: appName }).toArray();
            console.log(result)
        } catch (error) {
            throw error;
        }
    }
    async isHedgeActive(): Promise<boolean> {
        const appName = _.get(process.env, "APP_NAME", undefined)
        try {
            const result: HedgeTask[] = await this.hedgeCollection.find({ amm_name: appName }).toArray();
            for (const hedgeTask of result) {
                if (hedgeTask.status === "active") {
                    return true
                }
            }
            return false
        } catch (error) {
            throw error;
        }
    }
    async getHedgeType(): Promise<string> {
        let HedgeType = "Null"
        const appName = _.get(process.env, "APP_NAME", undefined)
        try {
            const result: HedgeTask[] = await this.hedgeCollection.find({ amm_name: appName }).toArray();
            for (const hedgeTask of result) {
                if (hedgeTask.status === "active") {
                    HedgeType = hedgeTask.risk_config.hedge_mode
                    return HedgeType
                }
            }
            return HedgeType

        } catch (error) {
            throw error;
        }
    }
    async getHedgeAccount(): Promise<string | null> {
        let hedgeAccount = null;
        const appName = _.get(process.env, "APP_NAME", undefined)
        try {
            const result: HedgeTask[] = await this.hedgeCollection.find({ amm_name: appName }).toArray();
            for (const hedgeTask of result) {
                if (hedgeTask.status === "active") {
                    hedgeAccount =  hedgeTask.cex_account_id.toString()
                    return hedgeAccount
                }
            }
            return hedgeAccount

        } catch (error) {
            throw error;
        }
    }
    async getHedgeAccountList(): Promise<{

        apiType: ICexAccountApiType;
        accountId: string;
        exchangeName: string;
        spotAccount?: {
            apiKey: string;
            apiSecret: string;
        };
        usdtFutureAccount?: {
            apiKey: string;
            apiSecret: string;
        };
        coinFutureAccount?: {
            apiKey: string;
            apiSecret: string;
        };
    }[]> {

        try {
            const accounts: HedgeAccount[] = await this.hedgeAccountCollection.find({}).toArray();
            return accounts.map(account => ({
                apiType: ICexAccountApiType.exchange_adapter,
                accountId: account._id.toString(),
                exchangeName: account.exchange,
                spotAccount: {
                    apiKey: account.api_key,
                    apiSecret: account.api_secret
                },
                usdtFutureAccount: {
                    apiKey: '',
                    apiSecret: ''
                },
                coinFutureAccount: {
                    apiKey: '',
                    apiSecret: ''
                }
            }));
        } catch (error: any) {
            this.logger.error(`Error fetching hedge account list: ${error.message}`, error.stack);
            return [];
        }
    }
    async getHedgeByBridgeId(bridgeId: string): Promise<HedgeTask | null> {
        const appName = _.get(process.env, "APP_NAME", undefined)
        const findOpt: any = {
            "amm_name": appName,
            bridge_id: new ObjectId(bridgeId),
            "status": "active"
        }
        try {
            const result: HedgeTask | null = await this.hedgeCollection.findOne(findOpt);
            return result
        } catch (error) {
            throw error;
        }
    }
}