import redis


def delete_keys_with_prefix():
    # 创建 Redis 连接
    client = redis.Redis(
        host='redis-cluster-proxy.user-system-vaughnmedellins394',
        port=6379,
        password='Iqu7obyKqjuXKylq',
        decode_responses=True
    )

    # 定义要匹配的前缀
    prefix = 'otmoiclp-vaughnmedellins394_otmoiclp:'

    # 使用 SCAN 命令获取所有键
    try:
        cursor = '0'
        while cursor != 0:
            cursor, keys = client.scan(cursor=cursor)
            print(f"Scanned keys: {keys}")
            for key in keys:
                if key.startswith(prefix):
                    # 去掉前缀部分
                    stripped_key = key[len(prefix):]

                    print(
                        f"Original Key: {key}, Stripped Key: {stripped_key}")

                    result = client.delete(stripped_key)
                    if result == 1:
                        print(f"Deleted key: {key}")
                    else:
                        print(f"Failed to delete key: {key}")
                else:
                    print(f"Key does not match prefix: {key}")
    except redis.exceptions.RedisError as error:
        print(f"Error connecting to Redis: {error}")


if __name__ == "__main__":
    delete_keys_with_prefix()
