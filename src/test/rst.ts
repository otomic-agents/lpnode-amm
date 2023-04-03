import { RedisStore } from "../redis_store";
async function main() {
  const store = new RedisStore("SYSTEM_ORDER");
  store.removeByPrimaryKey(1, { hash: "1" });
}
main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    console.error(e);
  });
