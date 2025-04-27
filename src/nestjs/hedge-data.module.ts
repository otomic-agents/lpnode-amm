import { Module } from '@nestjs/common';
import { MongoModule } from './providers/database/mongo.module';
import { RedisModule } from './providers/database/redis.module';
import { HedgeDataService } from './HedgeData/hedge_data.service';
@Module({
    imports: [MongoModule,RedisModule],
    controllers: [],
    providers: [
        HedgeDataService,
    
    ],
    exports: []
})
export class HedgeDataModule { }