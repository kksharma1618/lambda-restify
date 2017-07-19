import { LamdaCallback } from './lamda_callback'
import Request from './request'
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
    private statusCode: string
    private _body: string

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
    private __send() {
        this.callLamdaCallback()

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
        code = code || 200
        headers = headers || {}

        // Populate our response object with the derived arguments
        this.statusCode = code
        this._body = body
        Object.keys(headers).forEach(k => {
            this.header(k, headers[k])
        })

        
        // Flush takes our constructed response object and sends it to the client
        let _flush = (formattedBody) => {
            this._data = formattedBody;

            // Flush headers
            this.writeHead(this.statusCode);

            // Send body if it was provided
            if (this._data) {
                this.write(this._data);
            }

            // Finish request
            this.end();

            // If log level is set to trace, log the entire response object
            if (log.trace()) {
                log.trace({ res: this }, 'response sent');
            }

            // Return the response object back out to the caller of __send
            return this;
        }

        // 204 = No Content and 304 = Not Modified, we don't want to send the
        // body in these cases. HEAD never provides a body.
        if (isHead || code === 204 || code === 304) {
            return _flush();
        }

        // if no formatting, assert that the value to be written is a string
        // or a buffer, then send it.
        if (format === false) {
            assert.ok(typeof body === 'string' || Buffer.isBuffer(body),
                'res.sendRaw() accepts only strings or buffers');
            return _flush(body);
        }

        // if no body, then no need to format. if this was an error caught by a
        // domain, don't send the domain error either.
        if (body === undefined || (body instanceof Error && body.domain)) {
            return _flush();
        }

        // At this point we know we have a body that needs to be formatted, so lets
        // derive the formatter based on the response object's properties

        // _formatterError is used to handle any case where we were unable to
        // properly format the provided body
        function _formatterError(err) {
            // If the user provided a non-success error code, we don't want to mess
            // with it since their error is probably more important than our
            // inability to format their message.
            if (this.statusCode >= 200 && this.statusCode < 300) {
                this.statusCode = err.statusCode;
            }

            log.warn({
                req: this.req,
                err: err
            }, 'error retrieving formatter');

            return _flush();
        }

        var formatter;
        var type = this.contentType || this.getHeader('Content-Type');

        // Check to see if we can find a valid formatter
        if (!type && !this.req.accepts(this.acceptable)) {
            return _formatterError(new errors.NotAcceptableError({
                message: 'could not find suitable formatter'
            }));
        }

        // Derive type if not provided by the user
        if (!type) {
            type = this.req.accepts(this.acceptable);
        }

        type = type.split(';')[0];

        if (!this.formatters[type] && type.indexOf('/') === -1) {
            type = mime.lookup(type);
        }

        // If we were unable to derive a valid type, default to treating it as
        // arbitrary binary data per RFC 2046 Section 4.5.1
        if (!this.formatters[type] && this.acceptable.indexOf(type) === -1) {
            type = 'application/octet-stream';
        }

        formatter = this.formatters[type] || this.formatters['*/*'];

        // If after the above attempts we were still unable to derive a formatter,
        // provide a meaningful error message
        if (!formatter) {
            return _formatterError(new errors.InternalServerError({
                message: 'could not find formatter for application/octet-stream'
            }));
        }

        if (this._charSet) {
            type = type + '; charset=' + this._charSet;
        }

        // Update header to the derived content type for our formatter
        this.setHeader('Content-Type', type);

        // Finally, invoke the formatter and flush the request with it's results
        return _flush(formatter(this.req, this, body));
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