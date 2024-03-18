import { Mdb } from "../module/database/mdb";
import Agenda from "agenda";
import { logger } from "./logger";
import * as _ from "lodash";
const mongoConnectionString = Mdb.getInstance().getMongoDbUrl("main");
console.log("agenda config:", mongoConnectionString);

class SysMongoQueue {
  private _queueName: string;
  private agendaJob: Agenda;

  public constructor(queueName: string) {
    this._queueName = queueName;
    const agenda = new Agenda({ db: { address: mongoConnectionString } });
    this.agendaJob = agenda;
  }
  /**
   *
   * define task and start agenda
   * @param fun
   */
  public async process(fun: any) {
    this.agendaJob.define(`${this._queueName}-task`, async (job, done) => {
      try {
        const jobData = _.get(job, "attrs.data", {});
        if (JSON.stringify(jobData) === "{}") {
          logger.warn("job data is empty");
        }
        logger.info(
          `start execute task`,
          `${this._queueName}-task`,
          new Date().getTime()
        );
        // console.log("job", job);
        await fun(
          {
            name: this._queueName,
            time: new Date().getTime(),
            data: JSON.parse(JSON.stringify(jobData)),
          },
          done
        );
      } catch (e) {
        logger.error(`execute task`, e);
      } finally {
        done();
      }
    });
    this.agendaJob.start();
  }
  /**
   * add job and run now
   */
  public async add(data: any) {
    this.agendaJob.now(`${this._queueName}-task`, data);
  }
}

export { SysMongoQueue };
