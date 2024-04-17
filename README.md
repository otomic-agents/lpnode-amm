## Installation and Execution
```shell
npm i 
npx gulp
node dist src/main.js
```

## how to manage amm programs?
* in the otmoic application, by adding a bridge, you can select the available currency pairs needed for the amm application.
* through the otmoic application, you can view the amm runtime status, manage amm application configurations, which are in json format, allowing you to configure hedging, orderbook retrieval, and hedging accounts
## Program Functionality
The program provides quotation data for the LpNode application, allowing for hedging operations through the Cex exchange when the hedging function is activated. By default, the program supports spot trading. If a user exchanges ETH for USDT, the hedging program will sell ETH for USDT on the Cex exchange. In theory, maintaining a perpetual contract short position while concurrently holding a long position in the spot market can ensure that your net asset value remains unchanged.

Note: Currently, the hedging operation occurs at a later stage in the user's cross-chain behavior, specifically after the user confirms the transfer. From the time the user sees the price to the point they lock the price, several minutes may have elapsed, potentially resulting in significant execution slippage (which could be either positive or negative). To optimize this slippage, you can set the hedging operation to occur when the user locks the price.

## **Environment Variable Documentation**

| No. | Key | Value (Example) | Function Description                                     |
| --- | --- | --------------- | ------------------------------------------|
| 1   | STATUS_KEY | amm-status-report-amm-01 | Unique key used to identify status reports for applications such as AMMs.                |
| 2   | OS_API_KEY | bytetrade_otmoiclp_918853 | API key required for an application to access external operating system APIs.             |
| 3   | OS_API_SECRET | ****** | Security key paired with OS_API_KEY, used to authenticate the source and permissions of API requests. |
| 4   | OS_SYSTEM_SERVER | system-server.user-system-vaughnmedellins394 | Specifies the service endpoint or hostname for interaction with the operating system.                      |
| 5   | APP_NAME | amm-01 | The name of the application, identifying a specific AMM instance.                    |
| 6   | APP_VERSION | otmoic/otmoic-lpnode-amm:latest | Application version information.                  |
| 7   | REDIS_HOST | redis-cluster-proxy.user-system-vaughnmedellins394 | Hostname of the Redis cache server, used for data caching and communication.               |
| 8   | MONGODB_HOST | mongo-cluster-mongos.user-system-vaughnmedellins394 | Hostname of the MongoDB database server, storing persistent application data.          |
| 9   | NODE_ENV | production | Indicates the current runtime environment of the application, which is production in this case.                    |
| 10  | LP_MARKET_SERVICE_HOST | lpnode-market | Hostname of the trading adapter, used for transaction-related functions.                     |
| 11  | LP_ADMIN_PANEL_ACCESS_BASEURL | http://lpnode-admin-server:18006 | Base URL of the management panel, used to read system configurations.                     |
| 12  | MONGODB_PASSWORD | ****** | Password required to connect to the MongoDB database.                     |
| 13  | REDIS_PASSWORD | ****** | Password required to connect to the Redis server.                       |
| 14  | REDIS_PORT | 6379 | Port number on which the Redis server listens.                         |
| 15  | MONGODB_PORT | 27017 | Port number on which the MongoDB server listens.                       |
| 16  | MONGODB_ACCOUNT | root-vaughnmedellins394-otmoiclp | Account name used when connecting to MongoDB.                      |
| 17  | MONGODB_DBNAME_LP_STORE | otmoiclp-vaughnmedellins394_lp_store | Name of the MongoDB database that stores LP-related data.               |
| 18  | MONGODB_DBNAME_HISTORY | otmoiclp-vaughnmedellins394_businessHistory | Name of the MongoDB database that stores transaction history records.                 |

## Key Features
* Supports configuring trading slippage, which is compared during lock operations;
* Relies on the exchange-adapter program to connect to the Cex exchange and obtain the latest Orderbook for providing market quotations;
* Depends on the exchange-adapter for conducting order operations on Cex;
* Synchronizes your wallet balance from the Chain Node to determine whether it is sufficient to fulfill quote requests;
* Sets cross-chain transaction fees, which take effect during quoting;
* Whether a quote can be completed when hedging is enabled in the configuration depends on multiple factors, such as the Dex wallet balance, Cex spot balance, Orderbook liquidity, and Cex trade size restrictions;
* Supports installing multiple Amms, or modifying them after forking, and configuring different Amm hedging programs for each trading pair to meet market-making requirements;
* Works with the amm-analytics program to fully display complete information for each cross-chain trade, including exchanges and Cex orders;
* Pairs with lp-graphql to download and analyze profit and loss data from the MongoDB database.

## Configuration instructions.
* Find the AMM app in the dashboard and click on its icon to configure these parameters.
```js
// The "amm app" and "exchange_adapter app" both default to using the same configuration file for loading consistent account and exchange information.
{
  // Configuration for multiple blockchains, each with a unique chainId
  "chainDataConfig": [
    {
      "chainId": 9006, // Blockchain ID
      "config": {
        "maxSwapNativeTokenValue": "50000", // Maximum native token swap value; 1. Balance of target chain's native coin 2. Max amount for trades when hedging enabled 3. Balance of corresponding coin at CEX when hedging enabled 4. Configuration value. The maximum value in quotes is the minimum of 1, 2, 3, and 4.
        "minSwapNativeTokenValue": "0.5" // Deprecated value, currently not in effect
      }
    }
  ],
  // Bridge base configuration
  "bridgeBaseConfig": {
    "defaultFee": "0.003", // Cross-chain transaction fee
    "enabledHedge": false // Whether hedging is enabled
  },
  // Bridge-specific configurations, such as for ETH-USDT comparison. These configurations have higher priority than bridgeBaseConfig and override for the specified coin pair. Use this option if you want to enable hedging for certain pairs or set custom fees.
  "bridgeConfig": [{
    "defaultFee": "0.003", 
    "enabledHedge": false
  }],
  // Order book type, set to 'market' order book
  "orderBookType": "market", // When set to 'market', initializes as a Cex-type orderbook and retrieves it from the exchange_adapter. Currently supports only 'market'. For other orderbooks, configure a different value and implement the corresponding provider.
  "exchangeName": "binance", // If hedging is not enabled, or a corresponding hedgeAccount exchangeName is not found, the exchange_adapter app will use this exchange to retrieve the orderbook. The value should correspond to the respective value in ccxt pro. 
  // Hedge configuration
  "hedgeConfig": {
    "hedgeAccount": "001", // Hedge account ID, effective when 'enabledHedge' is true. The system reads the corresponding account information from 'accountList' based on this value. Currently, AMM app only supports spot-related accounts.
    "hedgeType": "CoinSpotHedge", // Hedge type
    "accountList": [ // Account list
      {
        "enablePrivateStream": false, // Whether to enable private stream
        "apiType": "exchange_adapter", // API type: Exchange adapter. Options: exchange | portfolio | exchange_adapter for local exchange implementation | using portfolio | using exchange_adapter. Configures how the system initializes the exchange for trade info, account sync, and order operations.
        "accountId": "001", // Account ID, when id equals 'hedgeConfig.hedgeAccount', this account will be load.
        "exchangeName": "binance", // Exchange name, valid when 'apiType' is 'portfolio' or 'exchange_adapter'
        "spotAccount": { // Spot account information
          "apiKey": "", // API key
          "apiSecret": "" // API secret
        },
        "usdtFutureAccount": { // USDT-margined futures account information
          "apiKey": "", // API key
          "apiSecret": "" // API secret
        },
        "coinFutureAccount": { // Coin-margined futures account information
          "apiKey": "", // API key
          "apiSecret": "" // API secret
        }
      }
    ]
  }
}
```
