const data = {
  bridges: [
    {
      bridge: {
        src_chain_id: 9006,
        dst_chain_id: 9006,
        src_token: "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B",
        dst_token: "0x61D35C6B6a7568542acA42448B47690650C69bb9",
        bridge_name: "9006_9006_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0x61D35C6B6a7568542acA42448B47690650C69bb9"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-A-B",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-bsc-server-9006:9100/evm-client-9006",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: {
        src_chain_id: 9006,
        dst_chain_id: 9006,
        src_token: "0x61D35C6B6a7568542acA42448B47690650C69bb9",
        dst_token: "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B",
        bridge_name: "9006_9006_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-B-A",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-bsc-server-9006:9100/evm-client-9006",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: { // 测试网配置成 AVAX-USDT
        src_chain_id: 9006,
        dst_chain_id: 9000,
        src_token: "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B",
        dst_token: "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
        bridge_name: "9006_9000_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-A-C",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-avax-server-9000:9100/evm-client-9000",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: {
        src_chain_id: 9000,
        dst_chain_id: 9006,
        src_token: "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
        dst_token: "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B",
        bridge_name: "9000_9006_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-C-A",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-bsc-server-9006:9100/evm-client-9006",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: { // 测试网配置为 ETH-USDT
        src_chain_id: 9006,
        dst_chain_id: 9000,
        src_token: "0x61D35C6B6a7568542acA42448B47690650C69bb9",
        dst_token: "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
        bridge_name: "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-B-C",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-avax-server-9000:9100/evm-client-9000",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: { // 测试网 USDT-ETH
        src_chain_id: 9000,
        dst_chain_id: 9006,
        src_token: "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
        dst_token: "0x61D35C6B6a7568542acA42448B47690650C69bb9",
        bridge_name: "9000_9006_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_0x61D35C6B6a7568542acA42448B47690650C69bb9"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-C-B",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-bsc-server-9006:9100/evm-client-9006",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: {
        src_chain_id: 9006,
        dst_chain_id: 397,
        src_token: "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B",
        dst_token: "0xc46adbee202892c5c989d515763a575bce534fa09c8bb4a13bcd7289a516e97b",
        bridge_name: "9006_397_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0xc46adbee202892c5c989d515763a575bce534fa09c8bb4a13bcd7289a516e97b"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
      msmq_name: "bridge-A-E",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-near-server-397:9100/near-client-397",
      relay_api_key: "96OZBSog7PeRHBn"
    },
    {
      bridge: {
        src_chain_id: 397,
        dst_chain_id: 9006,
        src_token: "0xc46adbee202892c5c989d515763a575bce534fa09c8bb4a13bcd7289a516e97b",
        dst_token: "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B",
        bridge_name: "397_9006_0xc46adbee202892c5c989d515763a575bce534fa09c8bb4a13bcd7289a516e97b_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B"
      },
      wallet: {
        name: "lp-wallet-1",
        balance: null
      },
      lp_receiver_address: "wallet2.obridge-test-lp1.testnet",
      msmq_name: "bridge-E-A",
      src_client_uri: "",
      dst_client_uri: "http://obridge-chain-client-evm-bsc-server-9006:9100/evm-client-9006",
      relay_api_key: "96OZBSog7PeRHBn"
    }
  ]
};
