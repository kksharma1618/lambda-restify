import { EventSource } from './event_source'
import * as assert from 'assert-plus'
import * as mime from "mime";
const Negotiator = require('negotiator')

export default class Request {

    public headers: { [key: string]: string }

    private negotiator
    private contentLengthCached: number | boolean
    private contentTypeCached: string
    private startingTime: number

    constructor(private source: EventSource) {
        this.headers = {}
        for (let key in source.headers) {
            this.headers[key.toLowerCase()] = source.headers[key]
        }
        this.negotiator = new Negotiator({
            headers: {
                accept: this.headers.accept || '*/*',
                'accept-encoding': this.headers['accept-encoding'] ||
                'identity'
            }
        })
        this.startingTime = Date.now()
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

        types = types.map(function (t) {
            assert.string(t, 'type')

            if (t.indexOf('/') === -1) {
                t = mime.lookup(t)
            }
            return t
        });

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

        var len = this.header('content-length')

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

        var index;
        var type = this.headers['content-type'];

        if (!type) {
            this.contentTypeCached = 'application/octet-stream'
        } else {
            if ((index = type.indexOf(';')) === -1) {
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
        return Object.assign({}, this.source.queryStringParameters || {})
    }
    public query() {
        return this.getQuery()
    }
}