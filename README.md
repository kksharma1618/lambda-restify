# lamda-restify
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
- Full support for restify request/resposne api
- Pre routing hooks 
- Middlewares
- Routing
- Versioned apis

## Getting started

### Install the package using
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
})
```