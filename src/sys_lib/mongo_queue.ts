import { sysQueueModel } from "../mongo_module/sys_queue";

class SysMongoQueue {
  private _queueName: string;

  public constructor(queueName: string) {
    this._queueName = queueName;
  }

  private async sleep() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(true);
      }, 20);
    });
  }

  public async process(fun: any) {
    const readDocFromMongo = async () => {
      return new Promise(async (resolve, reject) => {
        const ret = await sysQueueModel.findOne({
          queue_name: this._queueName,
          processed: false
        }).sort({ _id: 1 }).limit(1).lean();
        if (ret !== undefined && ret !== null) {
          console.log("new doc ...");
          fun({
            data: ret
          }, async () => {
            await sysQueueModel.updateOne({ _id: ret._id }, { $set: { processed: true } });
            resolve(true);
            readDocFromMongo().then(() => {
              console.log("read from mongo and process sucess");
            });
          });
        } else {
          await this.sleep();
          readDocFromMongo();
        }
      });
    };
    await readDocFromMongo();
  }

  public async add(data: any) {
    await sysQueueModel.create({
      queue_name: this._queueName,
      data
    });
  }
}

export { SysMongoQueue };
