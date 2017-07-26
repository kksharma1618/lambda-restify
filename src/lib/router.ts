import { EventEmitter } from 'events'
import { ServerOptions } from './server_options'
import { shallowCopy } from './restify_utils'
import * as assert from 'assert-plus'
import * as uuid from 'uuid'
import * as url from 'url'
import Request from './request'
import Response from './response'
import LRU from './lru-cache'
import Logger from './logger'
import * as semver from 'semver'
import * as errors from 'restify-errors'
const Negotiator = require('negotiator')

const DEF_CT = 'application/octet-stream'

export default class Router extends EventEmitter {
    public versions: string[]
    public mounts: any = {}

    private strict: boolean
    private routes: any = {
        DELETE: [],
        GET: [],
        HEAD: [],
        OPTIONS: [],
        PATCH: [],
        POST: [],
        PUT: []
    }
    private reverse: any = {}
    private contentType: string[] = []
    private cache: LRU
    private name = 'lambdaRestifyRouter'

    constructor(private options: ServerOptions, private log: Logger) {
        super()

        assert.object(options, 'options')

        this.cache = new LRU({ max: 100 })
        // this.contentType = options.contentType || []

        // if (!Array.isArray(this.contentType)) {
        //     this.contentType = [this.contentType]
        // }
        // assert.arrayOfString(this.contentType, 'options.contentType')

        this.strict = Boolean(options.strictRouting)

        let versions = options.versions || []

        if (!Array.isArray(versions)) {
            versions = [versions]
        }
        assert.arrayOfString(versions, 'options.versions')
        this.versions = versions

        this.versions.forEach((v) => {
            if (semver.valid(v)) {
                return true
            }

            throw new errors.InvalidArgumentError(v + ' is not a valid semver')
        })
        this.versions.sort()
    }
    public mount(options: any) {
        assert.object(options, 'options')
        assert.string(options.method, 'options.method')
        assert.string(options.name, 'options.name')

        let exists
        const name = options.name
        let route
        const routes = this.routes[options.method]
        const self = this
        let type = options.contentType || self.contentType
        let versions = options.versions || options.version || self.versions

        if (type) {
            if (!Array.isArray(type)) {
                type = [type]
            }
            type.filter((t) => {
                return (t)
            }).sort().join()
        }

        if (versions) {
            if (!Array.isArray(versions)) {
                versions = [versions]
            }
            versions.sort()
        }

        exists = routes.some((r) => {
            return r.name === name
        })

        if (exists) {
            return false
        }

        route = {
            name,
            method: options.method,
            path: compileURL({
                url: options.path || options.url,
                flags: options.flags,
                urlParamPattern: options.urlParamPattern,
                strict: self.strict
            }),
            spec: options,
            types: type,
            versions
        }
        routes.push(route)

        if (!this.reverse[route.path.source]) {
            this.reverse[route.path.source] = []
        }

        if (this.reverse[route.path.source].indexOf(route.method) === -1) {
            this.reverse[route.path.source].push(route.method)
        }

        this.mounts[route.name] = route

        this.emit('mount',
            route.method,
            route.path,
            route.types,
            route.versions)

        return route.name
    }
    public find(req: Request, res: Response, callback) {
        let candidates: any[] = []
        const ct = req.headers['content-type'] || DEF_CT
        const cacheKey = req.method + req.url + req.version() + ct
        let cacheVal
        let neg
        let params
        let r
        let reverse
        const routes = this.routes[req.method] || []
        let typed
        let versioned
        let maxV
        cacheVal = this.cache.get(cacheKey)
        if (cacheVal) {
            res._meta.methods = cacheVal.methods.slice()
            req._meta.matchedVersion = cacheVal.matchedVersion
            callback(null, cacheVal, shallowCopy(cacheVal.params))
            return
        }

        for (let i = 0; i < routes.length; i++) {
            try {
                params = matchURL(routes[i].path, req.path())
                // console.log('p', params, req.path())
            } catch (e) {
                this.log.trace({ err: e }, 'error parsing URL')
                callback(new errors.BadRequestError(e.message))
                return
            }

            if (params === false) {
                continue
            }

            reverse = this.reverse[routes[i].path.source]

            if (routes[i].types.length && req.isUpload()) {
                candidates.push({
                    p: params,
                    r: routes[i]
                })
                typed = true
                continue
            }

            // GH-283: we want to find the latest version for a given route,
            // not the first one.  However, if neither the client nor
            // server specified any version, we're done, because neither
            // cared
            if (routes[i].versions.length === 0 && req.version() === '*') {
                r = routes[i]
                break
            }

            if (routes[i].versions.length > 0) {
                candidates.push({
                    p: params,
                    r: routes[i]
                })
                versioned = true
            }
        }

        if (!r) {
            // If upload and typed
            if (typed) {
                const t = ct.split(/\s*,\s*/)
                candidates = candidates.filter((c) => {
                    neg = new Negotiator({
                        headers: {
                            accept: c.r.types.join(', ')
                        }
                    })
                    const tmp = neg.preferredMediaType(t)
                    return tmp && tmp.length
                })

                // Pick the first one in case not versioned
                if (candidates.length) {
                    r = candidates[0].r
                    params = candidates[0].p
                }
            }

            if (versioned) {
                candidates.forEach((c) => {
                    const k = c.r.versions
                    const v = semver.maxSatisfying(k, req.version())

                    if (v) {
                        if (!r || semver.gt(v, maxV)) {
                            r = c.r
                            params = c.p
                            maxV = v
                        }
                    }
                })
            }
        }

        // In order, we check if the route exists, in which case, we're good.
        // Otherwise we look to see if ver was set to false that would tell us
        // we indeed did find a matching route (method+url), but the version
        // field didn't line up, so we return bad version.  If no route and no
        // version, we now need to go walk the reverse map and look at whether
        // we should return 405 or 404.
        if (params && r) {
            // console.log('pr', params, r)
            cacheVal = {
                methods: reverse,
                name: r.name,
                params,
                spec: r.spec
            }

            if (versioned) {
                req._meta.matchedVersion = maxV
                cacheVal.matchedVersion = maxV
            }

            this.cache.set(cacheKey, cacheVal)
            res._meta.methods = reverse.slice()
            callback(null, cacheVal, shallowCopy(params))
            return
        }

        if (typed) {
            callback(new errors.UnsupportedMediaTypeError(ct))
            return
        }

        if (versioned) {
            callback(new errors.InvalidVersionError('%s is not supported by %s %s',
                req.version() || '?',
                req.method,
                req.path()))
            return
        }

        // Check for 405 instead of 404
        let j
        const urls = Object.keys(this.reverse)

        for (j = 0; j < urls.length; j++) {
            if (matchURL(new RegExp(urls[j]), req.path())) {
                res._meta.methods = this.reverse[urls[j]].slice()
                res.setHeader('Allow', res._meta.methods.join(', '))

                callback(new errors.MethodNotAllowedError('%s is not allowed',
                    req.method))
                return
            }
        }

        // clean up the url in case of potential xss
        // https://github.com/restify/node-restify/issues/1018
        callback(new errors.ResourceNotFoundError(
            '%s does not exist', url.parse(req.url).pathname
        ))
    }
}

/**
 * called while installing routes. attempts to compile the passed in string
 * or regexp and register it.
 * @private
 * @function compileURL
 * @param    {Object} options an options object
 * @returns  {RegExp}
 */
function compileURL(options): RegExp {
    if (options.url instanceof RegExp) {
        return options.url
    }
    assert.string(options.url, 'url')

    const params: string[] = []
    let pattern = '^'
    let re
    // tslint:disable-next-line:variable-name
    const _url = url.parse(options.url).pathname as string
    _url.split('/').forEach((frag) => {
        if (frag.length <= 0) {
            return false
        }

        pattern += '\\/+'

        if (frag.charAt(0) === ':') {
            let label = frag
            const index = frag.indexOf('(')
            let subexp

            if (index === -1) {
                if (options.urlParamPattern) {
                    subexp = options.urlParamPattern
                } else {
                    subexp = '[^/]*'
                }
            } else {
                label = frag.substring(0, index)
                subexp = frag.substring(index + 1, frag.length - 1)
            }
            pattern += '(' + subexp + ')'
            params.push(label.slice(1))
        } else {
            pattern += frag
        }
        return true
    })

    if (options.strict
        && _url.slice(-1) === '/') {
        pattern += '\\/'
    }

    if (!options.strict) {
        pattern += '[\\/]*'
    }

    if (pattern === '^') {
        pattern += '\\/'
    }

    pattern += '$'

    re = new RegExp(pattern, options.flags)
    re.restifyParams = params

    return re
}

/**
 * given a request, try to match it against the regular expression to
 * get the route params.
 * i.e., /foo/:param1/:param2
 * @private
 * @function matchURL
 * @param    {RegExp} re   a string or regular expression
 * @param    {String}          reqPath
 * @returns  {Object}
 */
function matchURL(re: RegExp, reqPath: string) {
    let i = 0
    const result = re.exec(reqPath)
    const params = {}
    const restifyParams = (re as any).restifyParams

    if (!result) {
        return false
    }

    // This means the user original specified a regexp match, not a url
    // string like /:foo/:bar
    if (!restifyParams) {
        for (i = 1; i < result.length; i++) {
            params[i - 1] = result[i]
        }

        return params
    }

    // This was a static string, like /foo
    if (restifyParams.length === 0) {
        return params
    }

    // This was the "normal" case, of /foo/:id
    restifyParams.forEach((p) => {
        if (++i < result!.length) {
            params[p] = decodeURIComponent(result![i])
        }
    })

    return params
}