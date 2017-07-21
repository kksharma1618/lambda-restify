import { LamdaCallback } from './lamda_callback'
import Request from './request'
import * as assert from 'assert-plus'
import * as url from 'url'
import { format as sprintf } from 'util'
import * as mime from 'mime'

import { createHttpError, createFormattersAndAcceptables, httpDate, shallowCopy, mergeQs, HEADER_ARRAY_BLACKLIST } from './restify_utils'

const fmt = createFormattersAndAcceptables()

export default class Response {

    private _finished = false
    public get finished() {
        return this._finished
    }
    private _headersSent = false
    public get headersSent() {
        return this._headersSent
    }
    public sendDate = true
    public statusCode: number
    public statusMessage: string
    public _meta: any = {}
    
    private _headers: { [key: string]: string | string[] } = {}
    private lamdaCallbackCalled = false
    private _body = ''
    private _data: any
    private _charSet: string

    constructor(private lamdaCallback: LamdaCallback, private req: Request) {

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
    public setHeader(name: string, value: any) {
        return this.header(name, value)
    }
    public getHeaders() {
        let headers = {}
        for (let name in this._headers) {
            let value = this._headers[name]
            if (Array.isArray(value)) {
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
    public removeHeader(name) {
        delete this._headers[name.toLowerCase()]
    }
    public writeHead(code?, message?, headers?) {
        if (code) {
            this.statusCode = code
        }
        if (typeof message === 'string') {
            this.statusMessage = message
        }
        if (typeof message === 'object') {
            headers = message
        }
        if (this.statusCode === 204 || this.statusCode === 304) {
            this.removeHeader('Content-Length');
            this.removeHeader('Content-MD5');
            this.removeHeader('Content-Type');
            this.removeHeader('Content-Encoding');
        }
        if (typeof headers === 'object') {
            Object.keys(headers).forEach(k => {
                // complete override, no multiple headers this way
                this.removeHeader(k)
                this.header(k, headers[k])
            })
        }
    }
    public write(chunk: string | Buffer, encoding?: string, callback?: any) {
        this._body = this._body + (typeof chunk === 'string' ? chunk.toString() : chunk.toString(encoding || 'base64'))
        if (typeof encoding === 'function') {
            callback = encoding
        }
        if (typeof callback === 'function') {
            process.nextTick(callback)
        }
        return true
    }
    public end() {
        this.callLamdaCallback()
        this._finished = true
        this._headersSent = true
    }
    private __send() {


        let isHead = this.req.method === 'HEAD'
        let code, body, headers, format

        // derive arguments from types, one by one
        let index = 0
        // Check to see if the first argument is a status code
        if (typeof arguments[index] === 'number') {
            code = arguments[index++]
        }

        // Check to see if the next argument is a body
        if (typeof arguments[index] === 'object' ||
            typeof arguments[index] === 'string') {
            body = arguments[index++]
        }

        // Check to see if the next argument is a collection of headers
        if (typeof arguments[index] === 'object') {
            headers = arguments[index++]
        }

        // Check to see if the next argument is the format boolean
        if (typeof arguments[index] === 'boolean') {
            format = arguments[index++]
        }

        // Now lets try to derive values for optional arguments that we were not
        // provided, otherwise we choose sane defaults.

        // If the body is an error object and we were not given a status code, try
        // to derive it from the error object, otherwise default to 500
        if (!code && body instanceof Error) {
            code = (body as any).statusCode || 500
        }

        // Set sane defaults for optional arguments if they were not provided and
        // we failed to derive their values
        code = code || this.statusCode || 200
        headers = headers || {}

        // Populate our response object with the derived arguments
        this.statusCode = code
        Object.keys(headers).forEach(k => {
            this.header(k, headers[k])
        })

        if(this.sendDate && !this.hasHeader('date')) {
            this.header('date', httpDate())
        }


        // Flush takes our constructed response object and sends it to the client
        let _flush = (formattedBody?) => {
            this._data = formattedBody

            // Flush headers
            this.writeHead(this.statusCode)
            // Send body if it was provided
            if (this._data) {
                this.write(this._data)
            }
            this.end()

            // Return the response object back out to the caller of __send
            return this
        }

        // 204 = No Content and 304 = Not Modified, we don't want to send the
        // body in these cases. HEAD never provides a body.
        if (isHead || code === 204 || code === 304) {
            return _flush()
        }

        // if no formatting, assert that the value to be written is a string
        // or a buffer, then send it.
        if (format === false) {
            assert.ok(typeof body === 'string' || Buffer.isBuffer(body),
                'res.sendRaw() accepts only strings or buffers');
            return _flush(body)
        }

        // if no body, then no need to format. if this was an error caught by a
        // domain, don't send the domain error either.
        if (body === undefined || (body instanceof Error && (body as any).domain)) {
            return _flush();
        }

        // At this point we know we have a body that needs to be formatted, so lets
        // derive the formatter based on the response object's properties

        // _formatterError is used to handle any case where we were unable to
        // properly format the provided body
        let _formatterError = (err) => {
            // If the user provided a non-success error code, we don't want to mess
            // with it since their error is probably more important than our
            // inability to format their message.
            if (this.statusCode >= 200 && this.statusCode < 300) {
                this.statusCode = err.statusCode
            }
            console.log({
                req: this.req,
                err: err
            }, 'error retrieving formatter')
            return _flush()
        }

        let formatter
        let type = this.header('Content-Type')
        // Check to see if we can find a valid formatter
        if (!type && !this.req.accepts(fmt.acceptable)) {
            return _formatterError(createHttpError('could not find suitable formatter', 406))
        }
        // Derive type if not provided by the user
        if (!type) {
            type = this.req.accepts(fmt.acceptable)
        }
        type = type.split(';')[0]

        if (!fmt.formatters[type] && type.indexOf('/') === -1) {
            type = mime.lookup(type)
        }
        
        // If we were unable to derive a valid type, default to treating it as
        // arbitrary binary data per RFC 2046 Section 4.5.1
        if (!fmt.formatters[type] && fmt.acceptable.indexOf(type) === -1) {
            type = 'application/octet-stream';
        }
        
        formatter = fmt.formatters[type] || fmt.formatters['*/*'];

        // If after the above attempts we were still unable to derive a formatter,
        // provide a meaningful error message
        if (!formatter) {
            return _formatterError(createHttpError('could not find formatter for application/octet-stream', 500))
        }

        if (this._charSet) {
            type = type + '; charset=' + this._charSet
        }

        // Update header to the derived content type for our formatter
        this.setHeader('Content-Type', type)
        
        // Finally, invoke the formatter and flush the request with it's results
        return _flush(formatter(this.req, this, body))
    }
    private callLamdaCallback() {
        if (!this.lamdaCallbackCalled) {
            this.lamdaCallbackCalled = true
            this.lamdaCallback(null, {
                statusCode: this.statusCode + '',
                body: this._body || this.statusMessage || '',
                headers: this.getHeaders()
            })
        }
    }
    public get(name: string) {
        return this.header(name)
    }
    public json(code?, object?, headers?) {
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
    public charSet(type: string) {
        assert.string(type, 'charset')
        this._charSet = type
        return this
    }
    public redirect(arg1, arg2?, arg3?) {

        let self = this
        let statusCode = 302
        let finalUri
        let redirectLocation
        let next
        // next is not mendatary in lamda restify version

        // 1) this is signature 1, where an explicit status code is passed in.
        //    MUST guard against null here, passing null is likely indicative
        //    of an attempt to call res.redirect(null, next);
        //    as a way to do a reload of the current page.
        if (arg1 && !isNaN(arg1)) {
            statusCode = arg1
            finalUri = arg2
            next = arg3
        }

        // 2) this is signaure number 2
        else if (typeof (arg1) === 'string') {
            // otherwise, it's a string, and use it directly
            finalUri = arg1
            next = arg2
        }

        // 3) signature number 3, using an options object.
        else if (typeof (arg1) === 'object') {

            // set next, then go to work.
            next = arg2;

            let req = self.req;
            let opt = arg1 || {};
            let currentFullPath = req.href()
            let secure = (opt.hasOwnProperty('secure')) ?
                opt.secure :
                req.isSecure()

            // if hostname is passed in, use that as the base,
            // otherwise fall back on current url.
            let parsedUri = url.parse(opt.hostname || currentFullPath, true)

            // create the object we'll use to format for the final uri.
            // this object will eventually get passed to url.format().
            // can't use parsedUri to seed it, as it confuses the url module
            // with some existing parsed state. instead, we'll pick the things
            // we want and use that as a starting point.
            finalUri = {
                port: parsedUri.port,
                hostname: parsedUri.hostname,
                query: parsedUri.query,
                pathname: parsedUri.pathname
            }

            // start building url based on options.
            // first, set protocol.
            finalUri.protocol = (secure === true) ? 'https' : 'http'

            // then set host
            if (opt.hostname) {
                finalUri.hostname = opt.hostname
            }

            // then set current path after the host
            if (opt.pathname) {
                finalUri.pathname = opt.pathname
            }

            // then set port
            if (opt.port) {
                finalUri.port = opt.port
            }

            // then add query params
            if (opt.query) {
                if (opt.overrideQuery === true) {
                    finalUri.query = opt.query
                } else {
                    finalUri.query = mergeQs(opt.query, finalUri.query)
                }
            }

            // change status code to 301 permanent if specified
            if (opt.permanent) {
                statusCode = 301
            }
        }


        // if we are missing a finalized uri
        // by this point, pass an error to next.
        if (!finalUri) {
            return next(createHttpError('could not construct url', 500))
        }

        redirectLocation = url.format(finalUri);

        self.send(statusCode, null, {
            Location: redirectLocation
        })

        if (typeof next === 'function') {
            next(false)
        }
    }
    public status(code) {
        assert.number(code, 'code')
        this.statusCode = code
        return code
    }
    public set(name, val?) {
        if (arguments.length === 2) {
            assert.string(name, 'res.set(name, val) requires name to be a string')
            this.header(name, val)
        } else {
            assert.object(name,
                'res.set(headers) requires headers to be an object')
            Object.keys(name).forEach((k) => {
                this.set(k, name[k])
            })
        }
        return this
    }
    public getHeaderNames() {
        return Object.keys(this._headers)
    }
    public hasHeader(name: string) {
        return this._headers.hasOwnProperty(name)
    }
    public writeContinue() {
        // noop
    }
}