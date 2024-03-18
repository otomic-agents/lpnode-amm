/* eslint-disable no-extend-native */
// @ts-ignore
Array.prototype.forEachAsync = async function (cb) {
  for (const x of this) {
    await cb(x);
  }
};
async function main() {
  // @ts-ignore
  await [1, 2, 3, 4].forEachAsync(async (item: any) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log(item);
        resolve(true);
      }, 1000);
    });
  });
}
main().then(() => {
  console.log(`all processed`);
});
