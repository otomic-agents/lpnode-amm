import * as _ from "lodash";
import { SysMongoQueue } from "../../sys_lib/mongo_queue";

const appName = _.get(process.env, "APP_NAME", undefined);
if (!appName) {
  throw new Error(`Queue name is incorrectly configured`);
}
const lockEventQueue = new SysMongoQueue(`SYSTEM_EVENT_LOCK_QUEUE_${appName}`);
export { lockEventQueue };
