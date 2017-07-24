import Request from './request'
import Response from './response'
import {LevelType} from './logger'

export type FormatterFunction = (req: Request, res: Response, body: any) => any

export type Formatters = {
    [key: string]: FormatterFunction
}

export interface ServerOptions {
    formatters?: Formatters,
    logLevel?: LevelType,
    name?: string,
    versions?: string | string[],
    strictRouting?: boolean,
    dontParseBody?: boolean
}
