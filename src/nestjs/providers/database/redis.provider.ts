import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisProvider implements OnModuleDestroy {
    private readonly logger = new Logger(RedisProvider.name);
    private connectionPool: Map<string, RedisClientType> = new Map();

    async getClient(options?: {
        newConnection?: boolean;
        key?: string;
    }): Promise<RedisClientType> {
        const { newConnection = false, key = 'default' } = options || {};
        
        if (!newConnection && this.connectionPool.has(key)) {
            return this.connectionPool.get(key);
        }

        const client = await this.createConnection();
        
        if (!newConnection) {
            this.connectionPool.set(key, client);
        }

        return client;
    }

    private async createConnection(): Promise<RedisClientType> {
        const client = createClient({
            socket: { 
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT || '6379'),
                reconnectStrategy: (retries) => Math.min(retries * 100, 5000)
            },
            password: process.env.REDIS_PASSWORD
        }) as RedisClientType;

        await client.connect();

        client.on('error', (err) => 
            this.logger.error('Redis connection error:', err)
        );

        return client;
    }

    async onModuleDestroy() {
        for (const [key, client] of this.connectionPool.entries()) {
            await client.quit();
            this.logger.log(`Closed Redis connection: ${key}`);
        }
    }
}
