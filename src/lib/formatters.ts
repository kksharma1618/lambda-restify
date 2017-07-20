import Request from './request'
import Response from './response'

export default {
    'application/javascript; q=0.1': function (req: Request, res: Response, body: any) {
        if (!body) {
            res.setHeader('Content-Length', 0)
            return null
        }

        if (Buffer.isBuffer(body)) {
            body = body.toString('base64');
        }

        let _cb = req.query().callback || req.query().jsonp
        let data

        if (_cb) {
            data = 'typeof ' + _cb + ' === \'function\' && ' +
                    _cb + '(' + JSON.stringify(body) + ');'
        } else {
            data = JSON.stringify(body)
        }

        data = data.replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029')

        res.setHeader('Content-Length', Buffer.byteLength(data))
        return data
    },
    'application/json; q=0.4': function (req: Request, res: Response, body: any) {
        let data = (body) ? JSON.stringify(body) : 'null'
        res.setHeader('Content-Length', Buffer.byteLength(data))
        return data
    },
    'text/plain; q=0.3': function (req: Request, res: Response, body: any) {
        let data = body ? body.toString() : ''
        res.setHeader('Content-Length', Buffer.byteLength(data))
        return data
    },
    'text/html; q=0.31': function (req: Request, res: Response, body: any) {
        let data = body ? body.toString() : ''
        res.setHeader('Content-Length', Buffer.byteLength(data))
        return data
    },
    'application/octet-stream; q=0.2': function (req: Request, res: Response, body: any) {
        if (!Buffer.isBuffer(body)) {
            body = new Buffer(body.toString())
        }
        res.setHeader('Content-Length', body.length)
        return body
    }
}