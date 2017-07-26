import { EventSource } from './event_source'
import * as assert from 'assert-plus'
import * as mime from "mime"
import * as uuid from 'uuid'
import * as url from 'url'
import { format } from 'util'
const Negotiator = require('negotiator')
import Logger from './logger'

export default class Request {

    public headers: { [key: string]: string }
    public url: string
    public httpVersion: string
    public method: string
    public params: { [key: string]: string }
    // tslint:disable-next-line:variable-name
    public _meta: any = {}
    public serverName: string
    public body: string | object
    public rawBody: string

    private negotiator
    private contentLengthCached: number | boolean
    private contentTypeCached: string
    private startingTime: number
    // tslint:disable-next-line:variable-name
    private _id: string
    private cachedUrlObject: url.Url
    private cachedUrl: string

    constructor(private source: EventSource, public log: Logger) {
        this.headers = {}
        Object.keys(source.headers).map((key) => {
            this.headers[key.toLowerCase()] = source.headers[key]
        })
        this.negotiator = new Negotiator({
            headers: {
                'accept': this.headers.accept || '*/*',
                'accept-encoding': this.headers['accept-encoding'] ||
                'identity'
            }
        })
        this.url = this.source.path

        if (this.source.queryStringParameters) {
            const urlObject = url.parse(this.url)
            urlObject.query = Object.assign({}, this.source.queryStringParameters)
            this.url = url.format(urlObject)
        }

        this.startingTime = Date.now()

        this.httpVersion = '2.0'
        if (this.headers.via) {
            this.httpVersion = this.headers.via.split(' ')[0]
        }
        this.method = this.source.httpMethod
        this.body = this.source.body
    }
    public header(name: string, value?: string) {
        assert.string(name, 'name')
        name = name.toLowerCase()

        if (name === 'referer' || name === 'referrer') {
            name = 'referer'
        }

        return this.headers[name] || value
    }
    public accepts(types: string | string[]) {
        if (typeof (types) === 'string') {
            types = [types]
        }

        types = types.map((t) => {
            assert.string(t, 'type')

            if (t.indexOf('/') === -1) {
                t = mime.lookup(t)
            }
            return t
        })

        return this.negotiator.preferredMediaType(types)
    }
    public acceptsEncoding(types: string | string[]) {
        if (typeof (types) === 'string') {
            types = [types]
        }

        assert.arrayOfString(types, 'types')

        return this.negotiator.preferredEncoding(types)
    }
    public getContentLength() {
        if (this.contentLengthCached !== undefined) {
            return (this.contentLengthCached === false ? undefined : this.contentLengthCached);
        }

        const len = this.header('content-length')

        if (!len) {
            this.contentLengthCached = false
        } else {
            this.contentLengthCached = parseInt(len, 10)
        }

        return this.contentLengthCached === false ? undefined : this.contentLengthCached
    }
    public contentLength() {
        return this.getContentLength()
    }
    public getContentType() {
        if (this.contentTypeCached !== undefined) {
            return (this.contentTypeCached)
        }

        let index
        const type = this.headers['content-type'];

        if (!type) {
            this.contentTypeCached = 'application/octet-stream'
        } else {
            index = type.indexOf(';')
            if (index === -1) {
                this.contentTypeCached = type;
            } else {
                this.contentTypeCached = type.substring(0, index)
            }
        }

        this.contentTypeCached = this.contentTypeCached.toLowerCase()

        return this.contentTypeCached
    }
    public contentType() {
        return this.getContentType()
    }
    public time() {
        return this.startingTime
    }
    public date() {
        return new Date(this.time())
    }
    public getQuery() {
        return this.getUrl().query
    }
    public query() {
        return this.getQuery()
    }
    public getUrl() {
        if (this.cachedUrl !== this.url) {
            this.cachedUrlObject = url.parse(this.url, true)
            this.cachedUrl = this.url
        }
        return this.cachedUrlObject
    }
    public href() {
        return this.getUrl().href
    }
    public id(reqId?: string) {

        if (reqId) {
            if (this._id) {
                throw new Error('request id is immutable, cannot be set again!')
            } else {
                assert.string(reqId, 'reqId')
                this._id = reqId
                return this._id
            }
        }

        return this.getId()
    }
    public getId() {

        if (this._id !== undefined) {
            return (this._id);
        }

        this._id = uuid.v4();

        return this._id
    }
    public getPath() {
        return this.getUrl().pathname || ""
    }
    public path() {
        return this.getPath()
    }
    public is(type) {
        assert.string(type, 'type')

        let contentType = this.getContentType() as any
        let matches = true

        if (!contentType) {
            return false
        }

        if (type.indexOf('/') === -1) {
            type = mime.lookup(type)
        }

        if (type.indexOf('*') !== -1) {
            type = type.split('/')
            contentType = contentType.split('/')
            matches = matches && (type[0] === '*' || type[0] === contentType[0])
            matches = matches && (type[1] === '*' || type[1] === contentType[1])
        } else {
            matches = (contentType === type)
        }

        return matches
    }
    public isSecure() {
        return this.header('X-Forwarded-Proto') === 'https'
    }
    public isChunked() {
        return this.header('transfer-encoding') === 'chunked'
    }
    public toString() {
        let headers = '';
        let str;

        Object.keys(this.headers).forEach((k) => {
            headers += format('%s: %s\n', k, this.headers[k]);
        });

        str = format('%s %s HTTP/%s\n%s',
            this.method,
            this.url,
            this.httpVersion,
            headers);

        return (str);
    }
    public userAgent() {
        return this.headers['user-agent']
    }
    public getVersion() {
        return this.headers['accept-version'] || this.headers['x-api-version'] || '*'
    }
    public version() {
        return this.getVersion()
    }
    public matchedVersion() {
        if (this._meta.matchedVersion !== undefined) {
            return (this._meta.matchedVersion);
        } else {
            return this.getVersion()
        }
    }
    public trailer(name: string, value?: string) {
        return value
    }
    public isKeepAlive() {
        if (this.headers.connection) {
            return /keep-alive/i.test(this.headers.connection)
        } else {
            return this.httpVersion === '1.0' ? false : true
        }
    }
    public isUpload() {
        return (this.method === 'PATCH' || this.method === 'POST' || this.method === 'PUT')
    }
}