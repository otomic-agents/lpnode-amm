import axios from 'axios';

// 定义接口时使用下划线命名
interface BridgeInfo {
  src_chain_id: number;
  dst_chain_id: number;
  src_token: string;
  dst_token: string;
  bridge_name: string;
  relay_api_key: string | null;
}

interface QuoteBase {
  bridge: BridgeInfo;
  lp_bridge_address: string;
  price: string;
  native_token_price: number;
  native_token_max: number;
  native_token_min: number;
  capacity: string;
  lp_node_uri: string;
  quote_hash: string | null;
  relay_api_key: string;
}

// 构造发送的数据
const data: QuoteBase[] = [{
  bridge: {
    src_chain_id: 9006,
    dst_chain_id: 501,
    src_token: "0x55d398326f99059fF775485246999027B3197955",
    dst_token: "0xc6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61",
    bridge_name: "9006_501_0x55d398326f99059fF775485246999027B3197955_0xc6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61",
    relay_api_key: null
  },
  lp_bridge_address: "0xC62a61B0C801A92CCfc1f90C49528ae4B0E160e6",
  price: "",
  native_token_price: 0,
  native_token_max: 1,
  native_token_min: 0.1,
  capacity: "0xa968163f0a57b000000",
  lp_node_uri: "https://48fcf1da.maximilianus.myterminus.com/lpnode",
  quote_hash: null,
  relay_api_key: "B2pAM9eBIKU5l5o"
}];

// URL 配置
const url = 'https://5b4522f4.nathanielight.myterminus.com/relay/lpnode/B2pAM9eBIKU5l5o/quote_and_live_confirmation';

// 创建并发请求
const promises = [];
for (let i = 0; i < 20; i++) {
  const startTime = new Date().getTime();
  const promise = axios.post(url, data, {
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    const endTime = new Date().getTime();
    const timeTaken = endTime - startTime;
    return {
      status: response.status,
      data: response.data,
      timeTaken: timeTaken
    };
  });
  promises.push(promise);
}

// 使用 Promise.all 处理所有并发请求
Promise.all(promises)
  .then(responses => {
    responses.forEach((response, index) => {
      console.log(`Request ${index + 1}:`);
      console.log('Status:', response.status);
      console.log('Data:', response.data);
      console.log('Response Time:', response.timeTaken, 'ms');
      console.log('------------------------');
    });
  })
  .catch(error => {
    if (error.response) {
      // 服务器响应的错误
      console.error('Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      // 请求发送失败
      console.error('Request Error:', error.request);
    } else {
      // 其他错误
      console.error('Error:', error.message);
    }
  });
