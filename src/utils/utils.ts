function TimeSleepMs(ms: number) {
  return new Promise((resolve: any) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
}
function TimeSleepForever(msg: string) {
  console.log(msg);
  return new Promise((resolve: any) => {
    //
  });
}
export { TimeSleepMs, TimeSleepForever };
