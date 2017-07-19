import { LamdaCallback } from './lamda_callback'
import * as assert from 'assert-plus'
import * as url from 'url'
import { format as sprintf } from 'util'

function httpDate(now) {
    if (!now) {
        now = new Date()
    }
    return now.toUTCString()
}
/**
 * Headers that cannot be multi-values.
 * @see #779, don't use comma separated values for set-cookie
 * @see #986, don't use comma separated values for content-type
 * @see http://tools.ietf.org/html/rfc6265#section-3
 */
const HEADER_ARRAY_BLACKLIST = {
    'set-cookie': true,
    'content-type': true
}

//TODO: charSet, 
export default class Response {
    private _headers: { [key: string]: string | string[] } = {}
    private lamdaCallbackCalled = false

    constructor(private lamdaCallback: LamdaCallback) {

    }
    public cache(type?: any, options?: any) {
        if (typeof (type) !== 'string') {
            options = type
            type = 'public'
        }

        if (options && options.maxAge !== undefined) {
            assert.number(options.maxAge, 'options.maxAge')
            type += ', max-age=' + options.maxAge
        }

        return this.header('Cache-Control', type)
    }
    public noCache() {
        // HTTP 1.1
        this.header('Cache-Control', 'no-cache, no-store, must-revalidate')

        // HTTP 1.0
        this.header('Pragma', 'no-cache')

        // Proxies
        this.header('Expires', '0')

        return this
    }
    public header(name: string, value?: any) {
        assert.string(name, 'name')
        name = name.toLowerCase()

        if (value === undefined) {
            return this._headers[name]
        }

        if (value instanceof Date) {
            value = httpDate(value)
        } else if (arguments.length > 2) {
            // Support res.header('foo', 'bar %s', 'baz');
            let arg = Array.prototype.slice.call(arguments).slice(2)
            value = sprintf(value, arg)
        }

        let current = this._headers[name]

        // Check the header blacklist before changing a header to an array
        if (current && !(name in HEADER_ARRAY_BLACKLIST)) {

            if (Array.isArray(current)) {
                current.push(value)
                value = current
            } else {
                value = [current, value]
            }
        }

        this._headers[name] = value
        return value
    }
    public getHeaders() {
        let headers = {}
        for(let name in this._headers) {
            let value = this._headers[name]
            if(Array.isArray(value)) {
                value = value.join(',')
            }
            headers[name] = value
        }
        return headers
    }
    public headers() {
        return this.getHeaders()
    }
    public send(code?: any, object?: any, headers?: any) {
        let args = Array.prototype.slice.call(arguments)
        args.push(true) // Append format = true to __send invocation
        return this.__send.apply(this, args)
    }
    public sendRaw(code?: any, object?: any, headers?: any) {
        let args = Array.prototype.slice.call(arguments)
        args.push(false) // Append format = false to __send invocation
        return this.__send.apply(this, args)
    }
    private __send() {
        this.callLamdaCallback()
    }
    private callLamdaCallback() {
        if (!this.lamdaCallbackCalled) {
            this.lamdaCallbackCalled = true
            
            this.lamdaCallback(null, {
                statusCode: '200',
                body: '',
                headers: this.getHeaders()
            })
        }
    }
    public get(name: string) {
        return this.header(name)
    }
    public json(code, object, headers) {
        if (!/application\/json/.test(this.header('content-type'))) {
            this.header('Content-Type', 'application/json');
        }
        return this.send(code, object, headers)
    }
    public link(l, rel) {
        assert.string(l, 'link')
        assert.string(rel, 'rel')

        let _link = sprintf('<%s>; rel="%s"', l, rel)
        return this.header('Link', _link)
    }
}