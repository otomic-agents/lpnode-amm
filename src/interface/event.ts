enum IEVENT_NAME {
  "CMD_ASK_QUOTE" = "CMD_ASK_QUOTE",
  "EVENT_LOCK_QUOTE" = "EVENT_LOCK_QUOTE", // 用户选择报价，并点击下一步时，表示锁定价格
  "EVENT_TRANSFER_OUT" = "EVENT_TRANSFER_OUT", // 跨链用户，点击Lock 完成Token 到合约的锁定后
  "EVENT_TRANSFER_OUT_CONFIRM" = "EVENT_TRANSFER_OUT_CONFIRM", // 如果用户在A链确认付款
  "EVENT_TRANSFER_OUT_REFUND" = "EVENT_TRANSFER_OUT_REFUND",
}

interface IEVENT_ASK_QUOTE {
  cmd: string;
  amount: string;
  cid: string;
}

interface IEVENT_LOCK_QUOTE {
  cmd: string;
  quote_data: any;
  quote_remove_info: any;
  pre_business: {
    swap_asset_information: {
      bridge_name: string;
      lp_id_fake: string;
      sender: string;
      amount: string;
      dst_address: string;
      dst_amount: string;
      dst_native_amount: string;
      time_lock: number;
      quote: {
        quote_base: {
          bridge: {
            src_chain_id: number;
            dst_chain_id: number;
            src_token: string;
            dst_token: string;
            bridge_name: string;
          };
          lp_bridge_address: string;
          price: string; // 10进制的价格
          native_token_price: string;
          capacity: string;
          lp_node_uri: string;
        };
        quote_name: string;
        timestamp: number;
      };
      system_fee_src: number
      system_fee_dst: number
      append_information: string;
    };
    hash: string | null;
    lp_salt: any;
    locked: any;
    timestamp: any;
  };
  business_full_data: any;
}

interface IEVENT_TRANSFER_OUT {
  // 用户Lock 钱进入合约账户后
  cmd: string;
  quote_data: any;
  quote_remove_info: any;
  pre_business: any;
  business_full_data: {
    pre_business: {
      swap_asset_information: {
        bridge_name: string; // "9006_9000_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
        lp_id_fake: string; // "9hQHZaZXcBJN3LJ";
        sender: string; // "0x1e1f3324f5482bacea3e07978278624f28e4ca4a";
        amount: string; // "1000000000000000000";
        dst_address: string; // "0x1e1f3324f5482bacea3e07978278624f28e4ca4a";
        dst_amount: string; // "1110000000000000000";
        dst_native_amount: string; // "0";
        time_lock: number; // 1673409932;
        quote: {
          quote_base: {
            bridge: {
              src_chain_id: number; // 9006;
              dst_chain_id: number; // 9000;
              src_token: string; // "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B";
              dst_token: string; // "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
              bridge_name: string; // "9006_9000_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
            };
            lp_bridge_address: string; // "0x4A6f7c5a6bb64D203F6306Da99a3762cAcB4083C";
            price: string; // "1.11";
            native_token_price: string; // "0";
            capacity: string; // "0xa968163f0a57b000000";
            lp_node_uri: string; // "https://obridge-api-lpnode-2.edge-dev.xyz/lpnode";
          };
          quote_name: string; // "9006_9000_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_9hQHZaZXcBJN3LJ";
          timestamp: number; // 1673409713110;
        };
        append_information: string; // '{"user_account_id":"0x1e1f3324f5482bacea3e07978278624f28e4ca4a"}';
      };
      hash: string; // "0x264d48ccd343b714";
      lp_salt: string; // "MZDRKTmgx1";
      locked: boolean; // true;
      timestamp: number | null; // null;
    };
    business: {
      business_id: number; // 99;
      step: number; // 2;
      business_hash: string; // "0x264d48ccd343b714";
    };
    event_transfer_out: {
      transfer_out_id: number; // 98;
      business_id: number; // 99;
      transfer_info: string; // '{"blockHash":"0x9b5e014e7be57929723249b08dd6aefe1dddd32ff349a3340f23f552fcf60ad1","blockNumber":"0x1907109","contractAddress":null,"cumulativeGasUsed":"0x3fe87","effectiveGasPrice":"0x2540be400","from":"0x1e1f3324f5482bacea3e07978278624f28e4ca4a","gasUsed":"0x10be7","logs":[{"address":"0x7e477f81fb9e7184190ca53c8b9069532408cc9b","topics":["0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925","0x0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a","0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c"],"data":"0x0000000000000000000000000000000000000000000000000000000000000000","blockNumber":"0x1907109","transactionHash":"0x65114ba43772be678af52d9f297af30f6adfada1b698e892c4896bb61bd800a8","transactionIndex":"0x3","blockHash":"0x9b5e014e7be57929723249b08dd6aefe1dddd32ff349a3340f23f552fcf60ad1","logIndex":"0x0","removed":false},{"address":"0x7e477f81fb9e7184190ca53c8b9069532408cc9b","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a","0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c"],"data":"0x0000000000000000000000000000000000000000000000000de0b6b3a7640000","blockNumber":"0x1907109","transactionHash":"0x65114ba43772be678af52d9f297af30f6adfada1b698e892c4896bb61bd800a8","transactionIndex":"0x3","blockHash":"0x9b5e014e7be57929723249b08dd6aefe1dddd32ff349a3340f23f552fcf60ad1","logIndex":"0x1","removed":false},{"address":"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c","topics":["0x573e213380faa927b1c1335457fe327e653e0604ed6a2c2f878f06a042896511"],"data":"0xc4fe73869f76e3e6c56df63a6c6082175ed55a39c903793c4d0d561d5b34f4140000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a0000000000000000000000004a6f7c5a6bb64d203f6306da99a3762cacb4083c0000000000000000000000007e477f81fb9e7184190ca53c8b9069532408cc9b0000000000000000000000000000000000000000000000000de0b6b3a76400005fe76a274803bbce2ae5f2feeb6d1e82f74ccf8ef795818d6cf347b38976de020000000000000000000000000000000000000000000000000000000063be358c00000000000000000000000000000000000000000000000000000000000023280000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a000000000000000000000000000000000000000000000000264d48ccd343b7140000000000000000000000005b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf230000000000000000000000000000000000000000000000000f67831e74af0000","blockNumber":"0x1907109","transactionHash":"0x65114ba43772be678af52d9f297af30f6adfada1b698e892c4896bb61bd800a8","transactionIndex":"0x3","blockHash":"0x9b5e014e7be57929723249b08dd6aefe1dddd32ff349a3340f23f552fcf60ad1","logIndex":"0x2","removed":false}],"logsBloom":"0x0000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000020000040000000000000000000020000000000000000000008000000800000000008000000000000000010000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000008000000000000000000002000000000000000000000000000000400000000000000008000000000000000000000a000008000000000000000000000000000000020000000000000001000010000008000000000000000000000000200000000000000000000000000000","status":"0x1","to":"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c","transactionHash":"0x65114ba43772be678af52d9f297af30f6adfada1b698e892c4896bb61bd800a8","transactionIndex":"0x3","type":"0x0"}';
      transfer_id: string; // "0xc4fe73869f76e3e6c56df63a6c6082175ed55a39c903793c4d0d561d5b34f414";
      sender: string; // "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A";
      receiver: string; // "0x4A6f7c5a6bb64D203F6306Da99a3762cAcB4083C";
      token: string; // "0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B";
      amount: string; // "1000000000000000000";
      hash_lock: string; // "0x5fe76a274803bbce2ae5f2feeb6d1e82f74ccf8ef795818d6cf347b38976de02";
      time_lock: number; // 1673409932;
      dst_chain_id: number; // 9000;
      dst_address: string; // "171965501528652954155215873577169194230145665610";
      bid_id: string; // "2759942191202940692";
      dst_token: string; // "522813855858055726445823725256461379841937096483";
      dst_amount: string; // "1110000000000000000";
    };
    event_transfer_in: null;
    event_transfer_out_confirm: null;
    event_transfer_in_confirm: null;
    event_transfer_out_refund: null;
    event_transfer_in_refund: null;
  };
}

interface IEVENT_TRANSFER_OUT_CONFIRM {
  cmd: string;
  quote_data: any;
  quote_remove_info: any;
  pre_business: any;
  business_full_data: {
    pre_business: {
      swap_asset_information: {
        bridge_name: string; // "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
        lp_id_fake: string; // "mOtYFrcPyMwjeki";
        sender: string; // "0x1e1f3324f5482bacea3e07978278624f28e4ca4a";
        amount: string; // "100000000000000000000";
        dst_address: string; // "0x1e1f3324f5482bacea3e07978278624f28e4ca4a";
        dst_amount: string; // "99700000000000000000";
        dst_native_amount: string; // "0";
        time_lock: number; // 1674049099;
        quote: {
          quote_base: {
            bridge: {
              src_chain_id: number; // 9006;
              dst_chain_id: number; // 9000;
              src_token: string; // "0x61D35C6B6a7568542acA42448B47690650C69bb9";
              dst_token: string; // "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
              bridge_name: string; // "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
            };
            lp_bridge_address: string; // "0x0648e55e37FbADa5ADD959243939d7A7b469d72a";
            price: string; // "0.997";
            native_token_price: string; // "0";
            native_token_max: string; // "1";
            native_token_min: string; // "0";
            capacity: string; // "0xa968163f0a57b000000";
            lp_node_uri: string; // "https://obridge-api-lpnode-1.edge-dev.xyz/lpnode";
          };
          quote_name: string; // "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_mOtYFrcPyMwjeki";
          timestamp: number; // 1674013097443;
        };
        append_information: string; // '{"user_account_id":"0x1e1f3324f5482bacea3e07978278624f28e4ca4a"}';
      };
      hash: string; // "0x86b5ff9143ea8f63";
      lp_salt: string; // "88VhDA2R9U";
      locked: boolean; // true;
      timestamp: number; // null;
    };
    business: {
      business_id: number; //  127;
      step: number; // 2;
      business_hash: string; // "0x86b5ff9143ea8f63";
    };
    event_transfer_out: {
      transfer_out_id: number; // 126;
      business_id: number; // 127;
      transfer_info: string; // '{"blockHash":"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f","blockNumber":"0x1938278","contractAddress":null,"cumulativeGasUsed":"0x35459","effectiveGasPrice":"0x2540be400","from":"0x1e1f3324f5482bacea3e07978278624f28e4ca4a","gasUsed":"0x10bff","logs":[{"address":"0x61d35c6b6a7568542aca42448b47690650c69bb9","topics":["0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925","0x0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a","0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c"],"data":"0x0000000000000000000000000000000000000000000000000000000000000000","blockNumber":"0x1938278","transactionHash":"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170","transactionIndex":"0x2","blockHash":"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f","logIndex":"0x5","removed":false},{"address":"0x61d35c6b6a7568542aca42448b47690650c69bb9","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a","0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c"],"data":"0x0000000000000000000000000000000000000000000000056bc75e2d63100000","blockNumber":"0x1938278","transactionHash":"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170","transactionIndex":"0x2","blockHash":"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f","logIndex":"0x6","removed":false},{"address":"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c","topics":["0x573e213380faa927b1c1335457fe327e653e0604ed6a2c2f878f06a042896511"],"data":"0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde005510000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a0000000000000000000000000648e55e37fbada5add959243939d7a7b469d72a00000000000000000000000061d35c6b6a7568542aca42448b47690650c69bb90000000000000000000000000000000000000000000000056bc75e2d63100000ce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e0000000000000000000000000000000000000000000000000000000063c7f64b00000000000000000000000000000000000000000000000000000000000023280000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a00000000000000000000000000000000000000000000000086b5ff9143ea8f630000000000000000000000005b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23000000000000000000000000000000000000000000000005679d8dc44a720000","blockNumber":"0x1938278","transactionHash":"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170","transactionIndex":"0x2","blockHash":"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f","logIndex":"0x7","removed":false}],"logsBloom":"0x0000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000040000000000000000000020000000000000000000008000000800000800008000000000000000010000000000000000000000000000000000000200000000000000000000000000001000000000000000000000000000000000000000000000000000008000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000a000008000000000000040000000000000000020000000000000001000010000008000000000000000000000000200000000000000000000000000000","status":"0x1","to":"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c","transactionHash":"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170","transactionIndex":"0x2","type":"0x0"}';
      transfer_id: string; // "0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551";
      sender: string; // "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A";
      receiver: string; // "0x0648e55e37FbADa5ADD959243939d7A7b469d72a";
      token: string; // "0x61D35C6B6a7568542acA42448B47690650C69bb9";
      amount: string; // "100000000000000000000";
      hash_lock: string; // "0xce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e";
      time_lock: number; // 1674049099;
      dst_chain_id: number; // 9000;
      dst_address: string; // "171965501528652954155215873577169194230145665610";
      bid_id: string; // "9706945571241758563";
      dst_token: string; // "522813855858055726445823725256461379841937096483";
      dst_amount: string; // "99700000000000000000";
    };
    event_transfer_in: {
      transfer_id: string; // "0xb68c59c62a95bef785238cd98beb759035700211015815ec6049ac40941e1602";
      sender: string; // "0x1C55a22A2AD9c2921706306ADFBdBee009987fce";
      receiver: string; //  "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A";
      token: string; // "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23";
      token_amount: string; //  "99700000000000000000";
      eth_amount: string; //  "0";
      hash_lock: string; //  "0xce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e";
      time_lock: number; // 1674049099;
      src_chain_id: number; // 9006;
      src_transfer_id: string; //  "0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551";
      transfer_info: string; // '{"blockHash":"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6","blockNumber":"0x11453c6","contractAddress":null,"cumulativeGasUsed":"0x13dfb","effectiveGasPrice":"0x60db8840a","from":"0x1c55a22a2ad9c2921706306adfbdbee009987fce","gasUsed":"0x13dfb","logs":[{"address":"0x5b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23","topics":["0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925","0x0000000000000000000000001c55a22a2ad9c2921706306adfbdbee009987fce","0x000000000000000000000000e244204c900613dd084ed8543b15616ba43b560a"],"data":"0x00000000000000000000000000000000000000000000663c5efb234d4c0f0000","blockNumber":"0x11453c6","transactionHash":"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd","transactionIndex":"0x0","blockHash":"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6","logIndex":"0x0","removed":false},{"address":"0x5b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000001c55a22a2ad9c2921706306adfbdbee009987fce","0x000000000000000000000000e244204c900613dd084ed8543b15616ba43b560a"],"data":"0x000000000000000000000000000000000000000000000005679d8dc44a720000","blockNumber":"0x11453c6","transactionHash":"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd","transactionIndex":"0x0","blockHash":"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6","logIndex":"0x1","removed":false},{"address":"0xe244204c900613dd084ed8543b15616ba43b560a","topics":["0x48e8c25194d6eb9633068bb38aea36f72e1c4b4d6e892ff556b8a63a803c2fd0"],"data":"0xb68c59c62a95bef785238cd98beb759035700211015815ec6049ac40941e16020000000000000000000000001c55a22a2ad9c2921706306adfbdbee009987fce0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a0000000000000000000000005b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23000000000000000000000000000000000000000000000005679d8dc44a7200000000000000000000000000000000000000000000000000000000000000000000ce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e0000000000000000000000000000000000000000000000000000000063c7f64b000000000000000000000000000000000000000000000000000000000000232ee610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551","blockNumber":"0x11453c6","transactionHash":"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd","transactionIndex":"0x0","blockHash":"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6","logIndex":"0x2","removed":false}],"logsBloom":"0x00000000000000000000000060000000000000000000000000000000000000000000000000000000080000000000000000000000004000000000008000200000008000000000000000000028000000010000000000000000000000000000000000000000000000000000000000000000000000000020000000000010000000000000000000000000880000000000000800000000000000000080000000000000020000000000000000000000000001000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000010000000000000000000000100000000000000000000000000000000000000","status":"0x1","to":"0xe244204c900613dd084ed8543b15616ba43b560a","transactionHash":"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd","transactionIndex":"0x0","type":"0x2"}';
    };
    event_transfer_out_confirm: {
      business_id: number; // 127;
      transfer_info: string; // '{"blockHash":"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47","blockNumber":"0x19382a0","contractAddress":null,"cumulativeGasUsed":"0xc717e","effectiveGasPrice":"0x2540be400","from":"0x1e1f3324f5482bacea3e07978278624f28e4ca4a","gasUsed":"0x10b52","logs":[{"address":"0x61d35c6b6a7568542aca42448b47690650c69bb9","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c","0x0000000000000000000000000648e55e37fbada5add959243939d7a7b469d72a"],"data":"0x0000000000000000000000000000000000000000000000056bc75e2d63100000","blockNumber":"0x19382a0","transactionHash":"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9","transactionIndex":"0x9","blockHash":"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47","logIndex":"0x13","removed":false},{"address":"0x61d35c6b6a7568542aca42448b47690650c69bb9","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c","0x0000000000000000000000003c73d73a500373c7689b480a0f7b4b3f35600d52"],"data":"0x0000000000000000000000000000000000000000000000000000000000000000","blockNumber":"0x19382a0","transactionHash":"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9","transactionIndex":"0x9","blockHash":"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47","logIndex":"0x14","removed":false},{"address":"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c","topics":["0xb7ae890c7a4721f7ed769dabfeee74f0e0f5bcdaad9cab432ccea4d9fa435b50"],"data":"0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551368dfd4a1440ba7c2b68c0114a429a548165b19a199b5fbc3cd596f84bc56e78","blockNumber":"0x19382a0","transactionHash":"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9","transactionIndex":"0x9","blockHash":"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47","logIndex":"0x15","removed":false}],"logsBloom":"0x0000000000001000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000200008000000800000800000000000000000000000000000000000000040000000000000000000200000000000000000000000000001000000000000000000000000000000000800000000000000000408000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000a000100000000000000040000000000000000000000000000000001000000000000001000000000000000000000200000000000004000000000000000","status":"0x1","to":"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c","transactionHash":"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9","transactionIndex":"0x9","type":"0x0"}';
      transfer_id: string; // "0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551";
      preimage: string; //  "0x368dfd4a1440ba7c2b68c0114a429a548165b19a199b5fbc3cd596f84bc56e78";
    };
    event_transfer_in_confirm: any; // null;
    event_transfer_out_refund: any; // null;
    event_transfer_in_refund: any; // null;
  };
}

export {
  IEVENT_NAME,
  IEVENT_LOCK_QUOTE,
  IEVENT_TRANSFER_OUT,
  IEVENT_TRANSFER_OUT_CONFIRM,
  IEVENT_ASK_QUOTE,
};
