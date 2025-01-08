declare global {
    namespace NodeJS {
        interface Process {
            _sys_config: {
                mdb: {
                    [key: string]: {
                        url: string;
                    };
                };
            };
        }
    }
}


export function initSysConfig() {
    if (!process._sys_config) {
        process._sys_config = {
            mdb: {
                default: {
                    url: 'mongodb://localhost:27017/default'
                   
                }
            }
        };
    }
}