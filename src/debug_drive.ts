import { redisPub } from "./redis_bus";
import { logger } from "./sys_lib/logger";
import * as _ from "lodash";
const mockLockEvent = `{
	"@class": "com.bytetrade.obridge.bean.CmdEvent",
	"cmd": "EVENT_LOCK_QUOTE",
	"quote_data": null,
	"quote_remove_info": null,
	"pre_business": {
		"@class": "com.bytetrade.obridge.bean.PreBusiness",
		"swap_asset_information": {
			"@class": "com.bytetrade.obridge.bean.SwapAssetInformation",
			"bridge_name": "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
			"lp_id_fake": "mOtYFrcPyMwjeki",
			"sender": "0x1e1f3324f5482bacea3e07978278624f28e4ca4a",
			"amount": "2000000000000000000",
			"dst_address": "0x1e1f3324f5482bacea3e07978278624f28e4ca4a",
			"dst_amount": "33600000000000000000000",
			"dst_native_amount": "2000000000000000000",
			"time_lock": 1673335567,
			"quote": {
				"@class": "com.bytetrade.obridge.bean.Quote",
				"quote_base": {
					"@class": "com.bytetrade.obridge.bean.QuoteBase",
					"bridge": {
						"@class": "com.bytetrade.obridge.bean.BridgeInfo",
						"src_chain_id": 9006,
						"dst_chain_id": 9000,
						"src_token": "0x61D35C6B6a7568542acA42448B47690650C69bb9",
						"dst_token": "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
						"bridge_name": "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23"
					},
					"lp_bridge_address": "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
					"price": "0.995",
          "quote_hash":"491fd05162fb3327659ae6ced49009d55d816df9",
					"native_token_price": "1",
					"capacity": "0xa968163f0a57b000000",
					"lp_node_uri": "https://obridge-api-lpnode-1.edge-dev.xyz/lpnode"
				},
				"quote_name": "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_mOtYFrcPyMwjeki",
				"timestamp": 1673335375511
			},
			"append_information": "{\\\"user_account_id\\\":\\\"0x1e1f3324f5482bacea3e07978278624f28e4ca4a\\\"}"
		},
		"hash": "0x194d3dd3189449db",
		"lp_salt": null,
		"locked": null,
		"timestamp": null
	},
	"business_full_data": null
}`;

const mockTxOutEvent = `{
	"@class": "com.bytetrade.obridge.bean.CmdEvent",
	"cmd": "EVENT_TRANSFER_OUT",
	"quote_data": null,
	"quote_remove_info": null,
	"pre_business": null,
  "business_full_data":{
    "@class":"com.bytetrade.obridge.bean.BusinessFullData",
    "pre_business":{
        "@class":"com.bytetrade.obridge.bean.PreBusiness",
        "swap_asset_information":{
            "@class":"com.bytetrade.obridge.bean.SwapAssetInformation",
            "bridge_name":"9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
            "lp_id_fake":"mOtYFrcPyMwjeki",
            "sender":"0x3c73d73a500373c7689b480a0f7b4b3f35600d52",
            "amount":"1000000000000000000",
            "dst_address":"0x3c73d73a500373c7689b480a0f7b4b3f35600d52",
            "dst_amount":"17437350000000000000000",
            "dst_native_amount":"1000000000000000000",
            "time_lock":1673422664,
            "quote":{
                "@class":"com.bytetrade.obridge.bean.Quote",
                "quote_base":{
                    "@class":"com.bytetrade.obridge.bean.QuoteBase",
                    "bridge":{
                        "@class":"com.bytetrade.obridge.bean.BridgeInfo",
                        "src_chain_id":9006,
                        "dst_chain_id":9000,
                        "src_token":"0x61D35C6B6a7568542acA42448B47690650C69bb9",
                        "dst_token":"0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
                        "bridge_name":"9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23"
                    },
                    "lp_bridge_address":"0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
                    "price":"17437.35",
                    "native_token_price":"1",
                    "capacity":"0xa968163f0a57b000000",
                    "lp_node_uri":"https://obridge-api-lpnode-1.edge-dev.xyz/lpnode"
                },
                "quote_name":"9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_mOtYFrcPyMwjeki",
                "timestamp":1673422483208
            },
            "append_information":"{\\\"user_account_id\\\":\\\"0x3c73d73a500373c7689b480a0f7b4b3f35600d52\\\"}"
        },
        "hash":"0xa95cf91613b989e2",
        "lp_salt":"4THhob9jZx",
        "locked":true,
        "timestamp":null
    },
    "business":{
        "@class":"com.bytetrade.obridge.bean.Business",
        "business_id":109,
        "step":2,
        "business_hash":"0xa95cf91613b989e2"
    },
    "event_transfer_out":{
        "@class":"com.bytetrade.obridge.bean.EventTransferOut",
        "transfer_out_id":108,
        "business_id":109,
        "transfer_info":"",
        "transfer_id":"0x4abe2d438d3d36f2b70c16545fced7d4de68258d10b31eff26b21e83fc8dc1b4",
        "sender":"0x3c73D73a500373C7689b480a0f7b4b3F35600d52",
        "receiver":"0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
        "token":"0x61D35C6B6a7568542acA42448B47690650C69bb9",
        "amount":"1000000000000000000",
        "hash_lock":"0x977987247ca7791b07f9c9afd85cbacc924239e3731afe662887ef6c96c5983b",
        "time_lock":1673422664,
        "dst_chain_id":9000,
        "dst_address":"345122780931470167811976944598675691319083404626",
        "bid_id":"12203902963482724834",
        "dst_token":"522813855858055726445823725256461379841937096483",
        "dst_amount":"17437350000000000000000"
    },
    "event_transfer_in":null,
    "event_transfer_out_confirm":null,
    "event_transfer_in_confirm":null,
    "event_transfer_out_refund":null,
    "event_transfer_in_refund":null
}
}`;

const mockTxOutConfirmEvent = `{
	"@class": "com.bytetrade.obridge.bean.CmdEvent",
	"cmd": "EVENT_TRANSFER_OUT_CONFIRM",
	"quote_data": null,
	"quote_remove_info": null,
	"pre_business": null,
	"business_full_data": {
		"@class": "com.bytetrade.obridge.bean.BusinessFullData",
		"pre_business": {
			"@class": "com.bytetrade.obridge.bean.PreBusiness",
			"swap_asset_information": {
				"@class": "com.bytetrade.obridge.bean.SwapAssetInformation",
				"bridge_name": "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
				"lp_id_fake": "mOtYFrcPyMwjeki",
				"sender": "0x1e1f3324f5482bacea3e07978278624f28e4ca4a",
				"amount": "100000000000000000000",
				"dst_address": "0x1e1f3324f5482bacea3e07978278624f28e4ca4a",
				"dst_amount": "99700000000000000000",
				"dst_native_amount": "0",
				"time_lock": 1674049099,
				"quote": {
					"@class": "com.bytetrade.obridge.bean.Quote",
					"quote_base": {
						"@class": "com.bytetrade.obridge.bean.QuoteBase",
						"bridge": {
							"@class": "com.bytetrade.obridge.bean.BridgeInfo",
							"src_chain_id": 9006,
							"dst_chain_id": 9000,
							"src_token": "0x61D35C6B6a7568542acA42448B47690650C69bb9",
							"dst_token": "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
							"bridge_name": "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23"
						},
						"lp_bridge_address": "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
						"price": "0.997",
						"native_token_price": "0",
						"native_token_max": "1",
						"native_token_min": "0",
						"capacity": "0xa968163f0a57b000000",
						"lp_node_uri": "https://obridge-api-lpnode-1.edge-dev.xyz/lpnode"
					},
					"quote_name": "9006_9000_0x61D35C6B6a7568542acA42448B47690650C69bb9_0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_mOtYFrcPyMwjeki",
					"timestamp": 1674013097443
				},
				"append_information": "{\\\"user_account_id\\\":\\\"0x1e1f3324f5482bacea3e07978278624f28e4ca4a\\\"}"
			},
			"hash": "0x86b5ff9143ea8f63",
			"lp_salt": "88VhDA2R9U",
			"locked": true,
			"timestamp": null
		},
		"business": {
			"@class": "com.bytetrade.obridge.bean.Business",
			"business_id": 127,
			"step": 2,
			"business_hash": "0x86b5ff9143ea8f63"
		},
		"event_transfer_out": {
			"@class": "com.bytetrade.obridge.bean.EventTransferOut",
			"transfer_out_id": 126,
			"business_id": 127,
			"transfer_info": "{\\\"blockHash\\\":\\\"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f\\\",\\\"blockNumber\\\":\\\"0x1938278\\\",\\\"contractAddress\\\":null,\\\"cumulativeGasUsed\\\":\\\"0x35459\\\",\\\"effectiveGasPrice\\\":\\\"0x2540be400\\\",\\\"from\\\":\\\"0x1e1f3324f5482bacea3e07978278624f28e4ca4a\\\",\\\"gasUsed\\\":\\\"0x10bff\\\",\\\"logs\\\":[{\\\"address\\\":\\\"0x61d35c6b6a7568542aca42448b47690650c69bb9\\\",\\\"topics\\\":[\\\"0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925\\\",\\\"0x0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a\\\",\\\"0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c\\\"],\\\"data\\\":\\\"0x0000000000000000000000000000000000000000000000000000000000000000\\\",\\\"blockNumber\\\":\\\"0x1938278\\\",\\\"transactionHash\\\":\\\"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170\\\",\\\"transactionIndex\\\":\\\"0x2\\\",\\\"blockHash\\\":\\\"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f\\\",\\\"logIndex\\\":\\\"0x5\\\",\\\"removed\\\":false},{\\\"address\\\":\\\"0x61d35c6b6a7568542aca42448b47690650c69bb9\\\",\\\"topics\\\":[\\\"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef\\\",\\\"0x0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a\\\",\\\"0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c\\\"],\\\"data\\\":\\\"0x0000000000000000000000000000000000000000000000056bc75e2d63100000\\\",\\\"blockNumber\\\":\\\"0x1938278\\\",\\\"transactionHash\\\":\\\"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170\\\",\\\"transactionIndex\\\":\\\"0x2\\\",\\\"blockHash\\\":\\\"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f\\\",\\\"logIndex\\\":\\\"0x6\\\",\\\"removed\\\":false},{\\\"address\\\":\\\"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c\\\",\\\"topics\\\":[\\\"0x573e213380faa927b1c1335457fe327e653e0604ed6a2c2f878f06a042896511\\\"],\\\"data\\\":\\\"0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde005510000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a0000000000000000000000000648e55e37fbada5add959243939d7a7b469d72a00000000000000000000000061d35c6b6a7568542aca42448b47690650c69bb90000000000000000000000000000000000000000000000056bc75e2d63100000ce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e0000000000000000000000000000000000000000000000000000000063c7f64b00000000000000000000000000000000000000000000000000000000000023280000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a00000000000000000000000000000000000000000000000086b5ff9143ea8f630000000000000000000000005b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23000000000000000000000000000000000000000000000005679d8dc44a720000\\\",\\\"blockNumber\\\":\\\"0x1938278\\\",\\\"transactionHash\\\":\\\"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170\\\",\\\"transactionIndex\\\":\\\"0x2\\\",\\\"blockHash\\\":\\\"0xbbd8306f7b800184ccf4a1123406e91ebf9fd24739950dc9787eba4a1d54457f\\\",\\\"logIndex\\\":\\\"0x7\\\",\\\"removed\\\":false}],\\\"logsBloom\\\":\\\"0x0000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000040000000000000000000020000000000000000000008000000800000800008000000000000000010000000000000000000000000000000000000200000000000000000000000000001000000000000000000000000000000000000000000000000000008000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000a000008000000000000040000000000000000020000000000000001000010000008000000000000000000000000200000000000000000000000000000\\\",\\\"status\\\":\\\"0x1\\\",\\\"to\\\":\\\"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c\\\",\\\"transactionHash\\\":\\\"0xd984849f109f630f10c089b7767f14d7f77681071c07a9912167f5a974603170\\\",\\\"transactionIndex\\\":\\\"0x2\\\",\\\"type\\\":\\\"0x0\\\"}",
			"transfer_id": "0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551",
			"sender": "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A",
			"receiver": "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
			"token": "0x61D35C6B6a7568542acA42448B47690650C69bb9",
			"amount": "100000000000000000000",
			"hash_lock": "0xce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e",
			"time_lock": 1674049099,
			"dst_chain_id": 9000,
			"dst_address": "171965501528652954155215873577169194230145665610",
			"bid_id": "9706945571241758563",
			"dst_token": "522813855858055726445823725256461379841937096483",
			"dst_amount": "99700000000000000000"
		},
		"event_transfer_in": {
			"@class": "com.bytetrade.obridge.bean.EventTransferIn",
			"transfer_id": "0xb68c59c62a95bef785238cd98beb759035700211015815ec6049ac40941e1602",
			"sender": "0x1C55a22A2AD9c2921706306ADFBdBee009987fce",
			"receiver": "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A",
			"token": "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23",
			"token_amount": "99700000000000000000",
			"eth_amount": "0",
			"hash_lock": "0xce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e",
			"time_lock": 1674049099,
			"src_chain_id": 9006,
			"src_transfer_id": "0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551",
			"transfer_info": "{\\\"blockHash\\\":\\\"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6\\\",\\\"blockNumber\\\":\\\"0x11453c6\\\",\\\"contractAddress\\\":null,\\\"cumulativeGasUsed\\\":\\\"0x13dfb\\\",\\\"effectiveGasPrice\\\":\\\"0x60db8840a\\\",\\\"from\\\":\\\"0x1c55a22a2ad9c2921706306adfbdbee009987fce\\\",\\\"gasUsed\\\":\\\"0x13dfb\\\",\\\"logs\\\":[{\\\"address\\\":\\\"0x5b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23\\\",\\\"topics\\\":[\\\"0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925\\\",\\\"0x0000000000000000000000001c55a22a2ad9c2921706306adfbdbee009987fce\\\",\\\"0x000000000000000000000000e244204c900613dd084ed8543b15616ba43b560a\\\"],\\\"data\\\":\\\"0x00000000000000000000000000000000000000000000663c5efb234d4c0f0000\\\",\\\"blockNumber\\\":\\\"0x11453c6\\\",\\\"transactionHash\\\":\\\"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd\\\",\\\"transactionIndex\\\":\\\"0x0\\\",\\\"blockHash\\\":\\\"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6\\\",\\\"logIndex\\\":\\\"0x0\\\",\\\"removed\\\":false},{\\\"address\\\":\\\"0x5b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23\\\",\\\"topics\\\":[\\\"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef\\\",\\\"0x0000000000000000000000001c55a22a2ad9c2921706306adfbdbee009987fce\\\",\\\"0x000000000000000000000000e244204c900613dd084ed8543b15616ba43b560a\\\"],\\\"data\\\":\\\"0x000000000000000000000000000000000000000000000005679d8dc44a720000\\\",\\\"blockNumber\\\":\\\"0x11453c6\\\",\\\"transactionHash\\\":\\\"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd\\\",\\\"transactionIndex\\\":\\\"0x0\\\",\\\"blockHash\\\":\\\"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6\\\",\\\"logIndex\\\":\\\"0x1\\\",\\\"removed\\\":false},{\\\"address\\\":\\\"0xe244204c900613dd084ed8543b15616ba43b560a\\\",\\\"topics\\\":[\\\"0x48e8c25194d6eb9633068bb38aea36f72e1c4b4d6e892ff556b8a63a803c2fd0\\\"],\\\"data\\\":\\\"0xb68c59c62a95bef785238cd98beb759035700211015815ec6049ac40941e16020000000000000000000000001c55a22a2ad9c2921706306adfbdbee009987fce0000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a0000000000000000000000005b93c8bb3b5e29214fa16cbf062a4ff3cf4fbf23000000000000000000000000000000000000000000000005679d8dc44a7200000000000000000000000000000000000000000000000000000000000000000000ce65b2940eba5b81a87a6b8bab5bc39fa581393fdfeca6ef05b9c232bf5eda7e0000000000000000000000000000000000000000000000000000000063c7f64b000000000000000000000000000000000000000000000000000000000000232ee610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551\\\",\\\"blockNumber\\\":\\\"0x11453c6\\\",\\\"transactionHash\\\":\\\"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd\\\",\\\"transactionIndex\\\":\\\"0x0\\\",\\\"blockHash\\\":\\\"0x2c8fe8fd6b2cbdf05de8d6315cdc9629077c9f205aaccc7ccebbac507d2a77d6\\\",\\\"logIndex\\\":\\\"0x2\\\",\\\"removed\\\":false}],\\\"logsBloom\\\":\\\"0x00000000000000000000000060000000000000000000000000000000000000000000000000000000080000000000000000000000004000000000008000200000008000000000000000000028000000010000000000000000000000000000000000000000000000000000000000000000000000000020000000000010000000000000000000000000880000000000000800000000000000000080000000000000020000000000000000000000000001000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000010000000000000000000000100000000000000000000000000000000000000\\\",\\\"status\\\":\\\"0x1\\\",\\\"to\\\":\\\"0xe244204c900613dd084ed8543b15616ba43b560a\\\",\\\"transactionHash\\\":\\\"0x1b60600f6d019008c83afe4e2eee612ab80cfa9aedc1c229cd3a94b90a8a4ecd\\\",\\\"transactionIndex\\\":\\\"0x0\\\",\\\"type\\\":\\\"0x2\\\"}"
		},
		"event_transfer_out_confirm": {
			"@class": "com.bytetrade.obridge.bean.EventTransferOutConfirm",
			"business_id": 127,
			"transfer_info": "{\\\"blockHash\\\":\\\"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47\\\",\\\"blockNumber\\\":\\\"0x19382a0\\\",\\\"contractAddress\\\":null,\\\"cumulativeGasUsed\\\":\\\"0xc717e\\\",\\\"effectiveGasPrice\\\":\\\"0x2540be400\\\",\\\"from\\\":\\\"0x1e1f3324f5482bacea3e07978278624f28e4ca4a\\\",\\\"gasUsed\\\":\\\"0x10b52\\\",\\\"logs\\\":[{\\\"address\\\":\\\"0x61d35c6b6a7568542aca42448b47690650c69bb9\\\",\\\"topics\\\":[\\\"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef\\\",\\\"0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c\\\",\\\"0x0000000000000000000000000648e55e37fbada5add959243939d7a7b469d72a\\\"],\\\"data\\\":\\\"0x0000000000000000000000000000000000000000000000056bc75e2d63100000\\\",\\\"blockNumber\\\":\\\"0x19382a0\\\",\\\"transactionHash\\\":\\\"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9\\\",\\\"transactionIndex\\\":\\\"0x9\\\",\\\"blockHash\\\":\\\"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47\\\",\\\"logIndex\\\":\\\"0x13\\\",\\\"removed\\\":false},{\\\"address\\\":\\\"0x61d35c6b6a7568542aca42448b47690650c69bb9\\\",\\\"topics\\\":[\\\"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef\\\",\\\"0x0000000000000000000000009d18cc6cfc0614e05af80355ab836e2cf945a91c\\\",\\\"0x0000000000000000000000003c73d73a500373c7689b480a0f7b4b3f35600d52\\\"],\\\"data\\\":\\\"0x0000000000000000000000000000000000000000000000000000000000000000\\\",\\\"blockNumber\\\":\\\"0x19382a0\\\",\\\"transactionHash\\\":\\\"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9\\\",\\\"transactionIndex\\\":\\\"0x9\\\",\\\"blockHash\\\":\\\"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47\\\",\\\"logIndex\\\":\\\"0x14\\\",\\\"removed\\\":false},{\\\"address\\\":\\\"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c\\\",\\\"topics\\\":[\\\"0xb7ae890c7a4721f7ed769dabfeee74f0e0f5bcdaad9cab432ccea4d9fa435b50\\\"],\\\"data\\\":\\\"0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551368dfd4a1440ba7c2b68c0114a429a548165b19a199b5fbc3cd596f84bc56e78\\\",\\\"blockNumber\\\":\\\"0x19382a0\\\",\\\"transactionHash\\\":\\\"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9\\\",\\\"transactionIndex\\\":\\\"0x9\\\",\\\"blockHash\\\":\\\"0xf9a81727771c1e98bb027a44102cceff5e44c5b4327f588a46f009108eabed47\\\",\\\"logIndex\\\":\\\"0x15\\\",\\\"removed\\\":false}],\\\"logsBloom\\\":\\\"0x0000000000001000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000200008000000800000800000000000000000000000000000000000000040000000000000000000200000000000000000000000000001000000000000000000000000000000000800000000000000000408000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000a000100000000000000040000000000000000000000000000000001000000000000001000000000000000000000200000000000004000000000000000\\\",\\\"status\\\":\\\"0x1\\\",\\\"to\\\":\\\"0x9d18cc6cfc0614e05af80355ab836e2cf945a91c\\\",\\\"transactionHash\\\":\\\"0x9d6e86ddf46b18828d4a55fb9ea3f1ff2833c5dcca51710b3ed7f358deed6be9\\\",\\\"transactionIndex\\\":\\\"0x9\\\",\\\"type\\\":\\\"0x0\\\"}",
			"transfer_id": "0xe610a13c257cedf3335f2b5388979d770225c32f277d7ba779370e6efde00551",
			"preimage": "0x368dfd4a1440ba7c2b68c0114a429a548165b19a199b5fbc3cd596f84bc56e78"
		},
		"event_transfer_in_confirm": null,
		"event_transfer_out_refund": null,
		"event_transfer_in_refund": null
	}
}`;
class DebugDrive {
  private enable = false;
  public async init() {
    if (!this.enable) {
      logger.warn(`debug false`);
      return;
    }
    logger.warn(`run debug ...`);
    this.run();
  }
  private sleep(ms: number) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }
  private async run() {
    const debug: any = _.attempt(() => {
      const isProd = _.get(
        process.env,
        "OBRIDGE_LPNODE_DB_REDIS_MASTER_SERVICE_HOST",
        null
      );
      if (isProd != null) {
        return false;
      }
      return true;
    });
    logger.debug("start mock data process");
    if (debug === false) {
      logger.debug(`disable mock`);
      return;
    }
    await this.sleep(1000 * 20);
    logger.debug(`.....`);
    redisPub.publish("bridge-B-C", mockLockEvent);
    await this.sleep(1000 * 10);
    logger.debug(`Mock`, "user client Lock , TxOut.....");
    redisPub.publish("bridge-B-C", mockTxOutEvent);

    await this.sleep(1000 * 10);
    logger.debug(`mock`, " TxOutConfirm");
    redisPub.publish("bridge-B-C", mockTxOutConfirmEvent);
  }
}

const debugDrive = new DebugDrive();
export { debugDrive, mockTxOutConfirmEvent };
