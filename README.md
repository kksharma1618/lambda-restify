# lamda-restify

[![Build Status](https://travis-ci.org/kksharma1618/lamda-restify.svg?branch=master)](https://travis-ci.org/kksharma1618/lamda-restify)

A [restify](http://restify.com/)/[expressjs](https://expressjs.com/) like interface for aws lamda with api gateway event.

## Installation
```
npm install --save lamda-restify
```

## What is it about
If you are writing [aws lamda function](https://aws.amazon.com/lambda/) to develop rest apis using [aws api gateway](https://aws.amazon.com/api-gateway/), this package will help you with request/response/routing/middlewares/versioned apis type features generally found in packages like restify or express.

Instead of using http module for opening a server and listening for incoming requests, this package relies on lamda event and callback.

When you make an http request against aws apigateway it triggers aws lamda with an event containing all the information about the incoming request (like method, url, querystring, headers, and body). lamda-restify relies on that information to create request object.

When your route handler sends response back (including headers, content), lamda-restify triggers lamda callback.

## Supported features
- Full support for restify request/response api
- Pre routing hooks 
- Middlewares
- Routing
- Versioned apis

## Dependency
It requires node >= 6.10.0. Make sure you choose "6.10.2" or above while creating lamda function. At the time of writing lamda supports v4.3.2 and 6.10.2.

## Getting started

### Install the package
```
npm install --save lamda-restify
```
### Create server
See list of supported options [here](https://github.com/kksharma1618/lamda-restify/blob/master/src/lib/server_options.ts).

```
const Server = require('lamda-restify');
const server = new Server(options);
```

### Attach your routes and middlewares
See [restify documentation](http://restify.com/docs/home/) for documentation on server.pre, server.use, server.get (and other http verbs). Since lamda-restify uses restify like interface all that docs apply here as well.

```
server.pre(function(req, res, next) {
    // this handler is run for all routes, even 404
    
    // do something here
    next()
})

server.use(function(req, res, next) {
    // this handler is run for after routing is done 
    // and successful match is found (not on 404)

    // do something here
    next()
})

server.post('/user/:id', function(req, res) {
    
    // headers available 
    const apiKey = req.header('apikey');
    
    // route param
    const userId = req.params.id;
    
    // query string
    const queryValue = req.query('queryKey')

    // body
    const name = req.body.name

    // send response with res.json or res.send
    res.json({
        status: 1
    })
})

// define other route handlers

```

### Attach lamda handler
```
exports.yourLamdaHandler = function(event, callback) {
    server.handleLamdaEvent(event, callback)
}
```

## Documentation
See [restify documentation](http://restify.com/docs/home/). Following items work just as they did in restify:
- Request:
    - headers
    - url
    - httpVersion
    - method
    - params
    - body
    - rawBody
    - header(name: string, defaultValue: string)
    - accepts(type: string | string[])
    - acceptsEncoding(type: string | string[])
    - getContentLength()
    - contentLength() [alias of getContentLength]
    - getContentType()
    - contentType() [alias of getContentType]
    - time()
    - date()
    - getQuery()
    - query() [alias of getQuery()]
    - getUrl()
    - href()
    - id(reqId?: string)
    - getId()
    - getPath()
    - path() [alias of getPath]
    - is(type: string)
    - isSecure()
    - isChunked()
    - toString()
    - userAgent()
    - version()
    - matchedVersion()
    - trailer(name: string, value?: string) [no trailers support. it just pass back the default value]
    - isKeepAlive()
    - isUpload()
- Response
    - finished
    - headersSent
    - sendDate
    - statusCode
    - statusMessage
    - serverName
    - cache(type?: any, options?: any)
    - noCache()
    - header(name: string, value?: any)
    - setHeader(name: string, value: any)
    - getHeaders()
    - headers() [alias of getHeaders]
    - send(code?: number, body?: string | json, headers?: json)
    - sendRaw(code?: number, body?: string | json, headers?: json)
    - removeHeader(name: string)
    - writeHead(code?, message?, headers?)
    - write(chunk: string | Buffer, encoding?: string, callback?: any)
    - end(data?: string | Buffer, encoding?: string, callback?)
    - get(name: string)
    - json(code?, body?, headers?)
    - link(l, rel)
    - charSet(type: string)
    - redirect(...)
    - status(code: number)
    - set(name: string | object, val?: string)
    - getHeaderNames()
    - hasHeader(name: string)
- Server
    - pre(handlers)
    - use(handlers)
    - get(path?, options?, handlers)
    - del(path?, options?, handlers)
    - head(path?, options?, handlers)
    - opts(path?, options?, handlers)
    - post(path?, options?, handlers)
    - put(path?, options?, handlers)
    - patch(path?, options?, handlers)
    - param(name, fn)
    - versionedUse(versions: string | string[], fn)

**Server.handleLamdaEvent(lamdaEvent, lamdaCallback)**<br />
Plug this into lamda handler to route all incoming lamda events.
