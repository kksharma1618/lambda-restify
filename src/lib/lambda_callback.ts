export type lambdaCallback = (error: Error | null, result?: {
    statusCode?: string,
    body?: string,
    headers?: {
        [key: string]: string
    }
}) => {}
