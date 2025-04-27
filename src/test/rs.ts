import axios from 'axios';

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
  relay_api_key: string | null;
}

interface QuoteAuthenticationLimiter {
  country_white_list: string;
  country_black_list: string;
  min_age: number;
  limiter_state: string;
}

interface RealtimeQuote {
  time: number;
  quote_base: QuoteBase;
  authentication_limiter: QuoteAuthenticationLimiter;
  cid: string;
}

const data: RealtimeQuote = {
  time: new Date().getTime(),
  quote_base: {
    bridge: {
      src_chain_id: 9006,
      dst_chain_id: 9006,
      src_token: "0xacda8bf66c2cadac9e99aa1aa75743f536e71094",
      dst_token: "0x57e73db0eebd89f722e064d4c209f86eba9daeec",
      bridge_name: "9006_9006_0xacda8bf66c2cadac9e99aa1aa75743f536e71094_0x57e73db0eebd89f722e064d4c209f86eba9daeec",
      relay_api_key: null
    },
    lp_bridge_address: "0x1E1f3324f5482bACeA3E07978278624F28e4ca4A",
    price: "0.00033858",
    native_token_price: 0.0016499498495486459378,
    native_token_max: 0.02507523,
    native_token_min: 0,
    capacity: "0x291510300446697250000000000000000",
    lp_node_uri: "https://48fcf1da.vaughnmedellins394.myterminus.com/lpnode",
    quote_hash: "70b999ac0d886a9fddaf8684d389026e53d2f8dd",
    relay_api_key: "DlJ2LAYyJNw3Wav"
  },
  authentication_limiter: {
    country_white_list: null,
    country_black_list: null,
    min_age: null,
    limiter_state: "off"
  },
  cid: "J68dRZmmPgYNBUTtAAky"
};

const relay_api_key = "DlJ2LAYyJNw3Wav";
const url = `https://5b4522f4.vaughnmedellins394.myterminus.com/relay/lpnode/${relay_api_key}/realtime_quote`;

const promises = [];
for (let i = 0; i < 150; i++) {
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
  }).catch(error => {
    if (error.response && error.response.status === 403) {
      console.error('=== 403 Forbidden Error ===');
      console.error('Request URL:', url);
      console.error('Request Headers:', error.config.headers);
      console.error('Request Body:', data);  
      console.error('Response Headers:', error.response.headers);
      console.error('Response Data:', error.response.data);
      console.error('========================');
    }
    throw error;
  });
  promises.push(promise);
}

Promise.all(promises)
  .then(responses => {
    responses.forEach((response, index) => {
      if (response.status === 200) {
        console.log(`Request ${index + 1}: Success`);
        console.log('Status:', response.status);
        console.log('Response Time:', response.timeTaken, 'ms');
      }
    });
  })
  .catch(error => {
    if (error.response && error.response.status !== 403) {
      console.error('Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    }
  });
