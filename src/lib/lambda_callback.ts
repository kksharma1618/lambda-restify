export type LamdaCallback = (error: Error | null, result?: {
    statusCode?: number | string,
    body?: string,
    headers?: {
        [key: string]: string
    }
}) => any
