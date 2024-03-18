#!/usr/bin/env python3
import logging
import requests
import json
import asyncio
import redis
from anyio import create_task_group, run

r = redis.Redis(host='localhost', port=6379, db=0)
channel_name = '0x57e73db0eebd89f722e064d4c209f86eba9daeec/0xacda8bf66c2cadac9e99aa1aa75743f536e71094_9006_9006'
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s:T+%(relativeCreated)d  %(levelname)s [%(pathname)s:%(lineno)d in '
                           'function %(funcName)s] %(message)s',
                    datefmt='%Y-%m-%d:%H:%M:%S', )


class WebServerTester:
    def __init__(self, base_url="http://localhost:18083/eventTest"):
        self.base_url = base_url

    def send_request_with_json_body(self, json_body):
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            self.base_url, json=json_body, headers=headers)
        return response.text

    def test_method1(self):
        json_body = {"cmd": "CMD_ASK_QUOTE",
                     "amount": "2", "cid": "1234567890"}
        return self.send_request_with_json_body(json_body)

    def test_method2(self, msg):
        json_body = {
            "cmd": "EVENT_LOCK_QUOTE",
            "pre_business": {
                "swap_asset_information": {
                    "quote": {
                        "quote_base": {
                            "quote_hash": msg.get("quote_data").get("quote_hash"),
                            "price": msg.get("quote_data").get("price"),
                            "amount": "2000000000000000000",
                        }
                    }
                }
            },
            "hash": "0x194d3dd3189449db"
        }
        print(json.dumps(json_body, indent=4))
        return self.send_request_with_json_body(json_body)

    def test_method3(self):
        json_body = {"keyX": "valueX", "keyY": "valueY"}
        return self.send_request_with_json_body(json_body)

    def test_method4(self):
        json_body = {"keyM": "valueM", "keyN": "valueN"}
        return self.send_request_with_json_body(json_body)

    def test_method5(self):
        json_body = {"keyZ": "valueZ", "keyW": "valueW"}
        return self.send_request_with_json_body(json_body)


tester = WebServerTester()


async def listen_message():
    pubsub = r.pubsub()
    pubsub.subscribe(channel_name)

    while True:
        message = pubsub.get_message(ignore_subscribe_messages=True)
        if message:
            msg = json.loads(message['data'].decode('utf-8'))
            if msg['cmd'] == 'CMD_UPDATE_QUOTE':
                logging.info("skipping CMD_UPDATE_QUOTE message")
                continue
            print(json.dumps(msg, indent=4))
            if msg['cmd'] == "EVENT_ASK_REPLY":
                logging.info("skipping EVENT_ASK_REPLY message")
                cid = msg.get('cid')
                quote_hash = msg.get("quote_data").get("quote_hash")
                logging.info(f"quote_hash: {quote_hash},cid: {cid}")
                print(f'lock queue at after 5 secs')
                await asyncio.sleep(5)
                tester.test_method2(msg)

        await asyncio.sleep(1)


async def test_runner():

    # call test_method1
    print("Result of test_method1:")
    print(tester.test_method1())


async def task_group():
    async with create_task_group() as tg:
        tg.start_soon(listen_message)
        await asyncio.sleep(5)
        tg.start_soon(test_runner)

# usage example
if __name__ == "__main__":

    run(task_group)
