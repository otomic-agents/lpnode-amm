import { Module, Global } from '@nestjs/common';
import { MongoProvider } from './mongo.provider';

@Global()
@Module({
    providers: [MongoProvider],
    exports: [MongoProvider]
})
export class MongoModule { }