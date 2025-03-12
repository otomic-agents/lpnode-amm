import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CalculateBaseService } from './calculate_base.service';
import { CalculateSwapService } from './calculate_swap.service';
@Injectable()
export class CalculateAndStoreOrderService implements OnModuleInit {
    private readonly logger = new Logger(CalculateAndStoreOrderService.name);

    @Inject()
    private readonly calculateBase: CalculateBaseService

    @Inject()
    private readonly calculateSwapService: CalculateSwapService

    async onModuleInit() {
        this.logger.log('CalculateAndStoreOrderService initializing...');
        this.processBase()
    }
    async processBase() {
        this.calculateBase.process().then(() => {

        });
        this.logger.log("calculateBase started");
        this.calculateSwapService.process().then(() => {

        });
        this.logger.log("calculateSwapService started");
    }
}