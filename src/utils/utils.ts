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

function LogExecutionTime(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = process.hrtime.bigint(); // Use high precision time
    try {
      const result = await originalMethod.apply(this, args);
      return result;
    } finally {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
      console.log(`${propertyKey} execution time: ${duration.toFixed(3)} ms`);
    }
  };

  return descriptor;
}

export { TimeSleepMs, TimeSleepForever, LogExecutionTime };
