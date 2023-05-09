/* eslint-disable arrow-parens */
import Bull from "bull";
import * as _ from "lodash";
const testQ = new Bull(`SYSTBULLQ2`, {
  settings: {
    backoffStrategies: {
      hedge(attemptsMade, err) {
        return 5000 + Math.random() * 500;
      },
    },
  },
  redis: { port: 6379, host: "127.0.0.1", password: undefined },
});

testQ.add({ v: 1 }, { attempts: 2, backoff: { type: "hedge" } });
testQ.add({ v: 2 }, { attempts: 2, backoff: { type: "hedge" } });
testQ.add({ v: 3 }, { attempts: 2 });
console.log(`添加队列完毕 `);

// console.log(`开始处理队列...¬`);
testQ.process((job, done) => {
  console.log(job);
  // const optAttempts = _.get(job, "opts.attempts", 0);
  // if (job.data.v === 2) {
  //   done(new Error("111"));
  //   console.log(_.get(job, "attemptsMade"), job);
  //   return;
  // }
  done();
});

async function main() {
  // const jobList = await testQ.getFailed();
  // // console.log(jobList);
  // jobList.forEach(async (job) => {
  //   // console.log(await job.moveToCompleted("manual", true, false));
  //   job.retry();
  // });
}
main().then(() => {
  console.log(`执行完毕`);
});
