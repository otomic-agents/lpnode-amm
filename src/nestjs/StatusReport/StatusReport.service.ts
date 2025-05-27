import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import axios from 'axios';

// Interface for dexBalance cache item
interface DexBalanceItem {
    chainName: string;
    tokenName: string; // Add tokenName field
    balance: number;
    lastUpdate: number;
}

// Interface for cexAccounts cache item
interface CexAccountsItem {
    names: string[];
    lastUpdate: number;
}

// Interface for the entire cache structure
interface CacheData {
    dexBalance: Record<string, DexBalanceItem>;
    cexAccounts: CexAccountsItem;
    cexAccountsBalanceLastUpdate:number;
}

// Metric interface for prometheus-like monitoring
interface Metric {
    name: string;
    type: string;
    labels: Record<string, string>;
    value: number;
}

@Injectable()
export class StatusReportService implements OnModuleInit {
    private readonly logger = new Logger(StatusReportService.name);
    private readonly metricsEndpoint: string;
    private readonly instanceName: string;
    private cexReportInterval: NodeJS.Timer;
    private cexBalanceLastUpdateReportInterval: NodeJS.Timer;

    // Initialize cache data
    private cacheData: CacheData = {
        dexBalance: {},
        cexAccounts: { names: [], lastUpdate: 0 },
        cexAccountsBalanceLastUpdate: 0,
    };

    constructor() {
        // Get metrics URL and instance name from environment variables
        this.metricsEndpoint = process.env.METRICS_ENDPOINT || 'http://localhost:8080/metrics';
        this.instanceName = process.env.INSTANCE_NAME || 'unknown';
        this.logger.log(`Initialized with metrics endpoint: ${this.metricsEndpoint}`);
        this.logger.log(`Initialized with instance name: ${this.instanceName}`);
    }

    async onModuleInit() {
        this.logger.log("StatusReportService onModuleInit");

        // Start scheduled task, send metrics every 30 seconds
        setInterval(() => {
            this.reportDexBalanceMetrics();
        }, 1000 * 30); // 30 seconds
        
        // Start CEX accounts metrics reporting task (every 20 seconds)
        this.cexReportInterval = setInterval(() => {
            this.reportCexAccountMetrics();
        }, 1000 * 20);

        this.cexBalanceLastUpdateReportInterval = setInterval(() => {
            this.reportCexAccountsBalanceLastUpdateMetric();
        }, 1000 * 30); // Report every 30 seconds
        this.logger.log("Metrics reporting started with configured intervals");
    }

    /**
     * Report the cex_accounts_balance_last_update metric
     */
    private reportCexAccountsBalanceLastUpdateMetric(): void {
        const metric: Metric = {
            name: "lpnode:amm:cex:accounts_balance_last_update",
            type: "gauge",
            labels: {
                instance: this.instanceName,
            },
            value: this.cacheData.cexAccountsBalanceLastUpdate,
        };

        this.sendMetricToMonitoringSystem(metric);
        this.logger.debug(`Reported cex_accounts_balance_last_update metric: ${metric.value}`);
    }

    /**
     * Set CEX account names (overwrites existing data)
     * @param names - Array of account names (pass empty array to clear)
     */
    setCexAccounts(names: string[]): void {
        this.cacheData.cexAccounts = {
            names,
            lastUpdate: new Date().getTime()
        };
        this.logger.debug(`Updated cexAccounts: ${names.length > 0 ? names.join(', ') : 'cleared'}`);
    }

    /**
     * Report CEX account metrics (executed every 20 seconds)
     */
    private reportCexAccountMetrics(): void {
        const accountData = this.cacheData.cexAccounts;

        // Generate metric (maintain millisecond timestamp)
        const metric: Metric = {
            name: "lpnode:amm:cex:accounts",
            type: "gauge",
            labels: {
                instance: this.instanceName,
                names: JSON.stringify(accountData.names)
            },
            value: accountData.lastUpdate // Millisecond timestamp
        };

        this.sendMetricToMonitoringSystem(metric);
        this.logger.debug(`Reported CEX accounts metric: ${JSON.stringify(accountData.names)}`);
    }

    /**
     * Set dexBalance for a specific chain and token
     * @param chainName - The blockchain chain name
     * @param tokenName - The token name
     * @param balance - The balance amount
     */
    setDexBalance(chainName: string, tokenName: string, balance: number): void {
        const key = `${chainName}_${tokenName}`;
        this.cacheData.dexBalance[key] = {
            chainName,
            tokenName,
            balance,
            lastUpdate: new Date().getTime(),
        };
        this.logger.debug(`Updated dexBalance for ${chainName}_${tokenName}: ${balance}`);
    }

    /**
     * Report all dexBalance metrics to monitoring system
     */
    private reportDexBalanceMetrics(): void {
        this.logger.log("reportDexBalanceMetrics...");
        const entries = Object.entries(this.cacheData.dexBalance);

        if (entries.length === 0) {
            this.logger.debug("No dexBalance metrics to report");
            return;
        }

        this.logger.debug(`Reporting ${entries.length} dexBalance metrics`);

        for (const [_, data] of entries) {
            try {
                const metric: Metric = {
                    name: "lpnode:amm:dex_balance",
                    type: "gauge",
                    labels: {
                        chainName: data.chainName,
                        tokenName: data.tokenName,
                        instance: this.instanceName,
                    },
                    value: data.balance
                };

                // Send metrics to monitoring system
                this.sendMetricToMonitoringSystem(metric);
            } catch (error:any) {
                this.logger.error(
                    `Failed to process or send metric for ${data.chainName}_${data.tokenName}: ${error.message}`,
                    error.stack
                );
            }
        }
    }

    /**
     * Send a metric to the monitoring system
     * @param metric - The metric to send
     */
    private sendMetricToMonitoringSystem(metric: Metric): void {
        this.logger.debug(`Sending metric to ${this.metricsEndpoint}: ${JSON.stringify(metric)}`);

        // Use axios to send metrics to the configured endpoint
        axios.post(this.metricsEndpoint, metric)
            .then(() => {
                this.logger.debug(`Successfully sent metric for ${metric.name}`);
            })
            .catch(error => {
                this.logger.error(`Failed to send metric: ${error.message}`);
            });
    }

    /**
     * Cleanup intervals when service is destroyed
     */
    onModuleDestroy() {
        if (this.cexReportInterval){
            clearInterval(this.cexReportInterval);
        }
        if (this.cexBalanceLastUpdateReportInterval) {
            clearInterval(this.cexBalanceLastUpdateReportInterval);
        }
        this.logger.log("CEX balance last update reporting interval cleared");
        this.logger.log("CEX accounts reporting interval cleared");
    }
}
