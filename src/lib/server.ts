import { EventEmitter } from 'events'
import { ServerOptions } from './server_options'
import { shallowCopy } from './restify_utils'
import * as assert from 'assert-plus'
import * as uuid from 'uuid'
import Request from './request'
import Response from './response'
import Router from './router'
import * as Logger from 'log'
import * as semver from 'semver'

export type HandlerFunction = (req: Request, res: Response, next: (err?: Error | null | false) => any) => any

export default class Server extends EventEmitter {
    private before: HandlerFunction[]
    private chain: HandlerFunction[]
    private versions: string[]
    private router: Router
    private routes: any = {}
    private log: Logger

    constructor(private options: ServerOptions = {}) {
        super()
        this.versions = options.versions ? (Array.isArray(options.versions) ? options.versions : [options.versions]) : []
        if (!options.log) {
            options.log = new Logger("info")
        }
        options.log.warn = options.log.warn || options.log.warning
        this.log = options.log
        this.router = new Router(options)
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
                throw new TypeError(v+' is not a valid semver')
            }
        })

        this.use((req, res, next) => {
            let ver

            if (req.version() === '*' ||
                (ver = semver.maxSatisfying(versions as string[],
                    req.version()) || false)) {
                fn.call(this, req, res, next, ver)
            } else {
                next()
            }
        });

        return this
    }
}

function argumentsToChain(args, start = 0) {
    assert.ok(args)
    args = Array.prototype.slice.call(args, start)

    if (args.length < 0) {
        throw new TypeError('handler (function) required')
    }

    var chain: HandlerFunction[] = [];

    function process(handlers) {
        for (var i = 0; i < handlers.length; i++) {
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