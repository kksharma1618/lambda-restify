import { EventEmitter } from 'events'
import { ServerOptions, FormatterFunction, Formatters} from './server_options'
import { shallowCopy, createFormattersAndAcceptables } from './restify_utils'
import * as assert from 'assert-plus'
import * as uuid from 'uuid'
import Request from './request'
import Response from './response'
import Router from './router'
import Logger from './logger'
import * as semver from 'semver'
import { EventSource } from './event_source'
import { LamdaCallback } from './lamda_callback'
import once from './once'
import * as utils from './utils'
import * as errors from 'restify-errors'
import bodyParser from './body_parser'

export type HandlerFunction = (req: Request, res: Response, next: (err?: Error | null | false) => any) => any

export default class Server extends EventEmitter {
    private before: HandlerFunction[] = []
    private chain: HandlerFunction[] = []
    private versions: string[]
    private router: Router
    private routes: any = {}
    private log: Logger
    private name: string
    private acceptable: string[]
    private formatters: Formatters

    constructor(private options: ServerOptions = {}) {
        super()
        this.versions = options.versions ? (Array.isArray(options.versions) ? options.versions : [options.versions]) : []
        this.log = new Logger(options.logLevel || Logger.INFO)
        this.name = options.name || "LamdaRestify"
        this.router = new Router(options, this.log)

        const fmt = createFormattersAndAcceptables(options.formatters)
        this.formatters = fmt.formatters
        this.acceptable = fmt.acceptable

        if(!options.dontParseBody) {
            this.pre(bodyParser)
        }
    }
    public pre(...args: any[]) {
        argumentsToChain(arguments).forEach(h => this.before.push(h))
        return this
    }
    public use(...args: any[]) {
        argumentsToChain(arguments).forEach(h => this.chain.push(h))
        return this
    }
    public del(...args: any[]) {
        return this.addMethodRoute('delete', ...args)
    }
    public get(...args: any[]) {
        return this.addMethodRoute('get', ...args)
    }
    public head(...args: any[]) {
        return this.addMethodRoute('head', ...args)
    }
    public opts(...args: any[]) {
        return this.addMethodRoute('options', ...args)
    }
    public post(...args: any[]) {
        return this.addMethodRoute('post', ...args)
    }
    public put(...args: any[]) {
        return this.addMethodRoute('put', ...args)
    }
    public patch(...args: any[]) {
        return this.addMethodRoute('patch', ...args)
    }
    private addMethodRoute(method: string, ...args: any[]) {
        if (args.length < 2) {
            throw new TypeError('handler (function) required')
        }
        let opts = args[0]
        this.log.trace('addMethodRoute', method, opts)
        if (opts instanceof RegExp || typeof opts === 'string') {
            opts = {
                path: opts
            }
        } else if (typeof opts === 'object') {
            opts = shallowCopy(opts)
        } else {
            throw new TypeError('path (string) required')
        }



        let chain: HandlerFunction[] = []
        let route
        let self = this

        function addHandler(h: HandlerFunction) {
            assert.func(h, 'handler')
            chain.push(h)
        }

        opts.method = method.toUpperCase()

        opts.versions = opts.versions || opts.version || self.versions

        if (!Array.isArray(opts.versions)) {
            opts.versions = [opts.versions]
        }

        if (!opts.name) {
            opts.name = method + '-' + (opts.path || opts.url)

            if (opts.versions.length > 0) {
                opts.name += '-' + opts.versions.join('--')
            }

            opts.name = opts.name.replace(/\W/g, '').toLowerCase()

            if (this.router.mounts[opts.name]) { // GH-401
                opts.name += uuid.v4().substr(0, 7)
            }
        }

        if (!(route = this.router.mount(opts))) {
            return false
        }

        this.chain.forEach(addHandler)
        argumentsToChain(arguments, 2).forEach(addHandler)
        this.routes[route] = chain

        this.log.trace('added method route', opts)

        return route
    }
    public param(name, fn) {
        this.use((req, res, next) => {
            if (req.params && req.params[name]) {
                fn.call(this, req, res, next, req.params[name], name)
            } else {
                next()
            }
        })
        return this
    }
    public versionedUse(versions: string | string[], fn) {
        if (!Array.isArray(versions)) {
            versions = [versions]
        }
        assert.arrayOfString(versions, 'versions');

        versions.forEach(function (v) {
            if (!semver.valid(v)) {
                throw new TypeError(v + ' is not a valid semver')
            }
        })

        this.use((req, res, next) => {
            let reqVersion = req.version()
            if(reqVersion === '*') {
                return next()
            }
            let ver = semver.maxSatisfying(versions as string[], reqVersion)
            if (ver) {
                fn.call(this, req, res, next, ver)
            } else {
                next()
            }
        });

        return this
    }
    public handleLamdaEvent(eventSource: EventSource, lamdaCallback: LamdaCallback) {
        this.log.trace('handleLamdaEvent', eventSource)
        const req = new Request(eventSource, this.log)
        const res = new Response(lamdaCallback, req, this.log, this.formatters, this.acceptable)
        this.log.trace('req,res', req.toString(), res.toString())
        this.setupRequest(req, res)
        this.handleRequest(req, res)
    }
    private setupRequest(req: Request, res: Response) {

        req.log = res.log = this.log
        req.serverName = this.name

        // res.acceptable = self.acceptable;
        // res.formatters = self.formatters;
        // res.req = req;
        res.serverName = this.name

        // set header only if name isn't empty string
        if (this.name !== '') {
            res.header('Server', this.name)
        }
        res.version = this.router.versions[this.router.versions.length - 1]
    }
    private handleRequest(req: Request, res: Response) {
        let self = this
        function routeAndRun() {
            self.log.trace('routeAndRun', req.path())
            self.route(req, res, function (route, context) {
                // emit 'routed' event after the req has been routed
                self.emit('routed', req, res, route)
                req._meta.context = req.params = context
                req._meta.route = route.spec

                let r = route ? route.name : null
                let chain = self.routes[r]

                self.runHandlerChain(req, res, route, chain, function done(e) {
                    self.log.trace('ranReqResCycle', e)
                })
            });
        }

        // run pre() handlers first before routing and running
        if (self.before.length > 0) {
            self.runHandlerChain(req, res, null, self.before, function (err) {
                // check for return false here - like with the regular handlers,
                // if false is returned we already sent a response and should stop
                // processing.
                if (err === false) {
                    return
                }
                if (!err) {
                    routeAndRun()
                }
            });
        } else {
            routeAndRun()
        }
    }
    private runHandlerChain(req: Request, res: Response, route, chain: HandlerFunction[], cb) {
        let d
        let i = -1

        if (!req._meta.anonFuncCount) {
            // Counter used to keep track of anonymous functions. Used when a
            // handler function is anonymous. This ensures we're using a
            // monotonically increasing int for anonymous handlers through out the
            // the lifetime of this request
            req._meta.anonFuncCount = 0
        }
        let log = this.log
        let self = this
        let handlerName: string
        let emittedError = false

        if (cb) {
            cb = once(cb)
        }

        function next(arg?) {
            let done = false

            if (arg) {
                if (arg instanceof Error) {

                    // if it's a formatter error, handle it differently.
                    if ((arg as any).code === 'Formatter') {
                        // in the case of formatter error, emit a formatterError
                        // event, which is like an uncaughtException scenario in
                        // that a response must be flushed by the handler.
                        res.status(500)

                        // if consumer listens to this event, they must flush a
                        // response or the request will hang. don't fire the event
                        // unless someone is listening to it.
                        if (self.listeners('FormatterError').length > 0) {
                            self.emit('FormatterError', req, res, route, arg);
                        } else {
                            // otherwise, log it and send empty response.
                            log.error(arg, 'error formatting response, ' +
                                'sending empty payload!')
                            res.send('')
                        }
                        // return early.
                        return
                    }

                    let errName = arg.name.replace(/Error$/, '');
                    log.trace({
                        err: arg,
                        errName: errName
                    }, 'next(err=%s)', (arg.name || 'Error'));

                    // always attempt to use the most specific error listener
                    // possible. fall back on generic 'error' listener if we can't
                    // find one for the error we got.
                    let hasErrListeners = false
                    let errEvtNames: string[] = []

                    // if we have listeners for the specific error
                    if (self.listeners(errName).length > 0) {
                        hasErrListeners = true
                        errEvtNames.push(errName)
                    }
                    // or if we have a generic error listener
                    if (self.listeners('restifyError').length > 0) {
                        hasErrListeners = true
                        errEvtNames.push('restifyError')
                    }

                    if (hasErrListeners) {
                        Promise.all(errEvtNames.map(function (evtName) {
                            return utils.promiseFromCallback(function (cb) {
                                self.emit(evtName, req, res, arg, cb)
                            })
                        })).then(function () {
                            res.send(arg)
                            cb(arg)
                        }).catch(function (err) {
                            res.send(err)
                            cb(err)
                        })
                        emittedError = true;
                    } else {
                        res.send(arg)
                    }
                    done = true
                }
            }

            if (arg === false) {
                done = true
            }


            // Run the next handler up
            if (!done && chain[++i]) {

                if ((chain[i] as any)._skip) {
                    return next()
                }

                if (log.trace()) {
                    log.trace('running %s', chain[i].name || '?');
                }

                req._meta.currentRoute = (route !== null ? route.name : 'pre')
                handlerName = (chain[i].name ||
                    ('handler-' + req._meta.anonFuncCount++));
                req._meta.currentHandler = handlerName;
                // req.startHandlerTimer(handlerName);

                let n = once(next)

                return chain[i].call(self, req, res, n)
            }

            // if (route === null) {
            //     self.emit('preDone', req, res);
            // } else {
            //     req.removeListener('close', _requestClose);
            //     req.removeListener('aborted', _requestAborted);
            //     self.emit('done', req, res, route);
            // }

            // Don't return cb here if we emit an error since we will cb after the
            // handler fires.
            if (!emittedError) {
                return (cb ? cb(arg) : true)
            } else {
                return (true)
            }
        }

        next()
    }
    private route(req, res, cb) {
        this.router.find(req, res, (err, route, ctx) => {
            this.log.trace('router.find.res', err, route, ctx)
            let r = route ? route.name : null;

            if (err) {
                if (!optionsError(err, req, res)) {
                    emitRouteError(this, req, res, err);
                }
            } else if (!r || !this.routes[r]) {
                err = new errors.ResourceNotFoundError(req.path());
                emitRouteError(this, res, res, err);
            } else {
                cb(route, ctx);
            }
        });
    }
}

function argumentsToChain(args, start = 0) {
    assert.ok(args)
    args = Array.prototype.slice.call(args, start)

    if (args.length < 0) {
        throw new TypeError('handler (function) required')
    }

    let chain: HandlerFunction[] = [];

    function process(handlers) {
        for (let i = 0; i < handlers.length; i++) {
            if (Array.isArray(handlers[i])) {
                process(handlers[i])
            } else {
                assert.func(handlers[i], 'handler');
                chain.push(handlers[i])
            }
        }
        return (chain)
    }

    return process(args)
}

/**
 * returns true if an error generated is for an options request.
 * @private
 * @function optionsError
 * @param    {Object}     err an error object
 * @param    {Object}     req the request object
 * @param    {Object}     res the response object
 * @returns  {Boolean}
 */
function optionsError(err, req: Request, res: Response) {
    
    if (err.statusCode === 404 && req.method === 'OPTIONS' && req.url === '*') {
        res.send(200)
        return true
    }

    return false
}

/**
 * when an error occurrs, this is used to emit an error to consumers
 * via EventEmitter.
 * @private
 * @function emitRouteError
 * @param    {Object} server the server object
 * @param    {Object} req    the request object
 * @param    {Object} res    the response object
 * @param    {Object} err    an error object
 * @returns  {undefined}
 */
function emitRouteError(server: Server, req: Request, res: Response, err) {

    let name

    if (err.name === 'ResourceNotFoundError') {
        name = 'NotFound'
    } else if (err.name === 'InvalidVersionError') {
        name = 'VersionNotAllowed'
    } else {
        name = err.name.replace(/Error$/, '')
    }

    req.log.trace({name: name, err: err}, 'entering emitRouteError');

    if (server.listeners(name).length > 0) {
        server.emit(name, req, res, err, once(function () {
            res.send(err)
        }));
    } else {
        res.send(err)
    }
}