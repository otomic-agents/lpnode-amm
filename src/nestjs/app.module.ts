import { Module } from '@nestjs/common';
import { MongoModule } from './providers/database/mongo.module';
import { DexWalletBalanceSyncService } from './balance/dex_wallet_balance_sync.service';
import { CalculateAndStoreOrderService } from './calculate/calculate_and_store_order.service';
import { CalculateBaseService } from './calculate/calculate_base.service';
import { CalculateSwapService } from './calculate/calculate_swap.service';
import { WalletDexAllBalanceSyncService } from './WalletDexAllBalanceSync/WalletDexAllBalanceSync.service';
import { RedisModule } from './providers/database/redis.module';
import { MarketDataSyncService } from './MarketDataSync/MarketDataSync.service';
import { WalletCexAllBalanceSyncService } from './WalletCexAllBalanceSync/WalletCexAllBalanceSync.service';
import { HedgeTaskDataSyncService } from './HedgeTaskDataSync/HedgeTaskDataSync.service';
@Module({
    imports: [MongoModule,RedisModule],
    controllers: [],
    providers: [
        DexWalletBalanceSyncService,
        CalculateAndStoreOrderService,
        CalculateBaseService,
        CalculateSwapService,
        WalletDexAllBalanceSyncService,
        WalletCexAllBalanceSyncService,
        MarketDataSyncService,
        HedgeTaskDataSyncService,
        
    ],
    exports: []
})
export class AppModule { }