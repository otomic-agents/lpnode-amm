import { Module } from '@nestjs/common';
import { MongoModule } from './providers/database/mongo.module';
import { DexWalletBalanceSyncService } from './service/dex_wallet_balance_sync.service';
import { CexBalanceSyncService } from './service/cex_balance_sync.service';
import { CalculateAndStoreOrderService } from './service/calculate_and_store_order.service';
import { CalculateBaseService } from './service/calculate_base.service';
import { CalculateSwapService } from './service/calculate_swap.service';
@Module({
    imports: [MongoModule],
    controllers: [],
    providers: [
        DexWalletBalanceSyncService,
        CexBalanceSyncService,
        CalculateAndStoreOrderService,
        CalculateBaseService,
        CalculateSwapService,
    ],
    exports: []
})
export class AppModule { }