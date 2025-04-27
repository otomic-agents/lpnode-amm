export interface HedgeTask {
    _id: string;
    name: string;
    exchange: string;
    api_key: string;
    api_secret: string;
    bridge_id: string;
    amm_name: string;
    cex_account_id: string;
    status: "active" | "inactive" | string;
    status_desc: string;
    created_at: string | Date;
    updated_at: string | Date;
    version: number;
    chain_pair: string[];
    initial_snapshot: {
        cex: {
            [tokenSymbol: string]: number;
        };
        dex: {
            [tokenSymbol: string]: number;
        };
        timestamp: string | Date;
    };
    risk_config: {
        max_asset_exposure: {
            [tokenSymbol: string]: number;
        };
        min_hedge_amount: {
            [tokenSymbol: string]: number;
        };
        hedge_mode: "SPOT" | "FUTURE" | string;
    };
    active_period: {
        start: string | Date;
        end: string | Date;
    };
}

export interface HedgeAccount {
    _id: string;
    name: string;
    exchange: string;
    api_key: string;
    api_secret: string;
    passphrase: string;
    status: string;
    created_at: string | Date;
    updated_at: string | Date;
    connection_status: {
        is_connected: boolean;
        last_checked_at: string | Date;
        error: string | null;
        ping_ms: number;
        markets_count: number | null;
    };
}