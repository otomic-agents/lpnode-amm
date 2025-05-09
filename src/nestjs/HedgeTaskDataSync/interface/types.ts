export interface HedgeTask {
    _id: string; // MongoDB default returns as ObjectId.toHexString()
    name: string;
    exchange: string;
    api_key: string;
    api_secret: string;
    bridge_id: string; // Same type as _id
    amm_name: string;
    cex_account_id: string; // Same type as _id
    status: string;
    status_desc: string; // Status description
    created_at: Date; // Or string (ISO) if not automatically converted to Date object
    updated_at: Date; // Same as created_at
    version: number;
    chain_pair: string[];
    chain_address: string[];
    chain_id_list: number[];
    wallet_list: string[]
    initial_snapshot: {
        cex: Record<string, number>;
        dex: Record<string, number>;
        timestamp: Date; // Snapshot timestamp
    };
    risk_config: {
        max_asset_exposure: Record<string, number>;
        min_hedge_amount: Record<string, number>;
        hedge_mode: string;
    };
    active_period?: {
        start: Date;
        end: Date;
    };
    latest_balance?: {
        cex: Record<string, number>;
        dex?: Record<string, number>;
        timestamp: Date;
    };
}