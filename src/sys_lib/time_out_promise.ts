function TimeOutPromise(userFun: any, timeout_ms = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(function() {
      reject(new Error(`Timeout Error ${timeout_ms}`));
    }, timeout_ms);
    userFun((val: any) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve(val);
    }, reject);
  });
}

export { TimeOutPromise };
