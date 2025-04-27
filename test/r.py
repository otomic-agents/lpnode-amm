import redis


def delete_keys_with_prefix():
    # Create Redis connection
    client = redis.Redis(
        host='redis-cluster-proxy.user-system-vaughnmedellins394',
        port=6379,
        password='Iqu7obyKqjuXKylq',
        decode_responses=True
    )

    # Define the prefix to match
    prefix = 'otmoiclp-vaughnmedellins394_otmoiclp:'

    # Use SCAN command to get all keys
    try:
        cursor = '0'
        while cursor != 0:
            cursor, keys = client.scan(cursor=cursor)
            print(f"Scanned keys: {keys}")
            for key in keys:
                if key.startswith(prefix):
                    # Remove the prefix part
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
