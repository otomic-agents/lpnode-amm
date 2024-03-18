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