import Request from './request'
import Response from './response'
import {LevelType} from './logger'

export interface ServerOptions {
    formatters?: {
        [key: string]: (req: Request, res: Response, body: any) => any
    },
    logLevel?: LevelType,
    name?: string,
    versions?: string | string[],
    strictRouting?: boolean,
    handleUncaughtExceptions?: boolean
}
