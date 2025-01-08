import { Module } from '@nestjs/common';
import { MongoModule } from './providers/database/mongo.module';
import { DexWalletBalanceSyncService } from './service/dex_wallet_balance_sync.service';
import { CexBalanceSyncService } from './service/cex_balance_sync.service';

@Module({
    imports: [MongoModule],
    controllers: [],
    providers: [DexWalletBalanceSyncService, CexBalanceSyncService],
    exports: []
})
export class AppModule { }