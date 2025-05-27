import { Module } from '@nestjs/common';
import { MongoModule } from './providers/database/mongo.module';
import { RedisModule } from './providers/database/redis.module';
import { StatusReportService } from './StatusReport/StatusReport.service';
@Module({
    imports: [MongoModule, RedisModule],
    controllers: [],
    providers: [StatusReportService],
    exports: []
})
export class StatusReportModule { }
