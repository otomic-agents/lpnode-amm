import { Logger, ILogObject } from "tslog";

const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const dayjs = require("dayjs");
dayjs.extend(utc);
dayjs.extend(timezone);
const log: Logger = new Logger({ dateTimeTimezone: "Asia/Shanghai" });
import * as _ from "lodash";

import { appendFileSync, mkdirSync } from "fs";
import * as fs from "fs";
import * as path from "path";

const logPath = path.join(__dirname, "../../log");
setInterval(() => {
  const list = fs.readdirSync(logPath);
  try {
    _.map(list, (item: string) => {
      if (!item || typeof item !== "string") {
        return;
      }
      const filePath = path.join(logPath, item);
      if (item.indexOf(".out") === -1 && item.indexOf(".err") === -1) {
        log.warn(`不是预期的想要删除的日志文件`, filePath); // 只删除结尾是 .out .err 的文件
        return;
      }
      if (filePath.indexOf(logPath) === -1) {
        // 必须在定义的log目录下
        log.warn(`预期目录之外的内容`, filePath);
        return;
      }

      const status = fs.statSync(filePath);
      if (status.isFile()) {
        // 必须是文件
        if (filePath.indexOf("/log/") !== -1) {
          // 必须在一个log目录下
          const passBy = new Date().getTime() - status.atimeMs;
          if (passBy > 1000 * 60 * 60 * 24 * 3) {
            // 时间大于3天
            log.debug("过去三天内没有更新", "Delete log file ", filePath);
            fs.unlinkSync(filePath);
          }
        }
      }
    });
  } catch (e) {
    log.error(`删除文件发生了错误`, e);
  }
}, 1000 * 60 * 60 * 6); // 六小时执行一次就可以了

function logToSendMessage(logObject: ILogObject) {
  if (!fs.existsSync(logPath)) {
    mkdirSync(logPath);
  }
  if (logObject.logLevel === "error" || logObject.logLevel === "fatal") {
    appendFileSync(
      path.join(logPath, `${dayjs().format("YYYY-MM-DD")}.err`),
      `${dayjs().format()} ${
        logObject.logLevel
      }  ${logObject.argumentsArray.join(" ")}  ${logObject.filePath} ${
        logObject.lineNumber
      }\n`
    );
  } else {
    appendFileSync(
      path.join(logPath, `${dayjs().format("YYYY-MM-DD")}.out`),
      `${dayjs().format()} ${
        logObject.logLevel
      }  ${logObject.argumentsArray.join(" ")} ${logObject.filePath} ${
        logObject.lineNumber
      }\n`
    );
  }
  if (logObject.logLevel === "error" || logObject.logLevel === "fatal") {
    const env = _.get(process, "env.NODE_ENV", "dev");
    if (logObject.argumentsArray[0] !== false && env === "production") {
      logObject.argumentsArray.unshift(
        `🚫 Line: ${_.get(
          logObject,
          "lineNumber",
          ""
        )}\n\n___________________\n`
      );
      logObject.argumentsArray.unshift(
        `🚫 File: ${_.get(logObject, "fullFilePath", "")}`
      );
    }
  }
}

log.attachTransport(
  {
    silly: logToSendMessage,
    debug: logToSendMessage,
    trace: logToSendMessage,
    info: logToSendMessage,
    warn: logToSendMessage,
    error: logToSendMessage,
    fatal: logToSendMessage,
  },
  "debug"
);
export { log as logger };
