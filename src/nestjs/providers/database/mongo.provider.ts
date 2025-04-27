import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import * as _ from 'lodash';

@Injectable()
export class MongoProvider implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MongoProvider.name);
    private clients: Map<string, MongoClient> = new Map();
    private dbs: Map<string, Db> = new Map();
    private isConnected: Map<string, boolean> = new Map();

    async onModuleInit() {
        await this.initialize();
    }

    async initialize(key: string = 'default'): Promise<void> {
        if (this.isConnected.get(key)) {
            return;
        }

        const host = process.env.MONGODB_HOST;
        const port = process.env.MONGODB_PORT;
        const username = process.env.MONGODB_ACCOUNT;
        const password = process.env.MONGODB_PASSWORD;
        const dbName = process.env.MONGODB_DBNAME_LP_STORE;

        const url = `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=${dbName}`;

        this.logger.debug(`Starting to connect to database: ${host}:${port}/${dbName}`);

        try {
            const client = new MongoClient(url, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                heartbeatFrequencyMS: 10000,
                maxPoolSize: 100,
                family: 4
            });

            await client.connect();
            const db = client.db(dbName);

            this.clients.set(key, client);
            this.dbs.set(key, db);
            this.isConnected.set(key, true);

            client.on('connectionReady', () => {
                this.logger.log(`MongoDB ${key} connected successfully`);
            });

            client.on('reconnect', () => {
                this.logger.log(`MongoDB ${key} reconnected...`);
            });

            this.logger.log(`🎉 MongoDB ${key} Connected Successfully to ${dbName}`);
        } catch (error) {
            this.logger.error(`❌ MongoDB ${key} Connection Error:`, error);
            throw error;
        }
    }

    getDb(key: string = 'default'): Db {
        const db = this.dbs.get(key);
        if (!db) {
            throw new Error(`MongoDB ${key} is not initialized`);
        }
        return db;
    }

    getCollection<T>(collectionName: string, key: string = 'default') {
        return this.getDb(key).collection<T>(collectionName);
    }

    async onModuleDestroy() {
        for (const [key, client] of this.clients.entries()) {
            await client.close();
            this.logger.log(`Closed MongoDB connection: ${key}`);
        }
    }
}
