import Request from './request'
import Response from './response'
import * as Logger from 'log'

export interface ServerOptions {
    formatters?: {
        [key: string]: (req: Request, res: Response, body: any) => any
    },
    log?: Logger,
    name?: string,
    versions?: string | string[],
    strictRouting?: boolean
}