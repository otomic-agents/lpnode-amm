import { lockEventQueue } from "../module/event_process/lock_queue";


lockEventQueue.process(async (job, done) => {
  console.log(job);
});


lockEventQueue.add({ message: "1" });
