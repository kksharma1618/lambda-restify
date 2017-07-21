import { EventEmitter } from 'events'
import { ServerOptions } from './server_options'
import { shallowCopy } from './restify_utils'
import * as assert from 'assert-plus'
import * as uuid from 'uuid'
import * as url from 'url'
import Request from './request'
import Response from './response'


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
    private contentType: string 

    constructor(private options: ServerOptions) {
        super()

        this.strict = Boolean(options.strictRouting)
    }


    public mount(options: any) {
        assert.object(options, 'options')
        assert.string(options.method, 'options.method')
        assert.string(options.name, 'options.name')

        let exists
        let name = options.name
        let route
        let routes = this.routes[options.method]
        let self = this
        let type = options.contentType || self.contentType
        let versions = options.versions || options.version || self.versions

        if (type) {
            if (!Array.isArray(type)) {
                type = [type]
            }
            type.filter(function (t) {
                return (t)
            }).sort().join()
        }

        if (versions) {
            if (!Array.isArray(versions)) {
                versions = [versions]
            }
            versions.sort()
        }

        exists = routes.some(function (r) {
            return r.name === name
        })

        if (exists) {
            return false
        }

        route = {
            name: name,
            method: options.method,
            path: compileURL({
                url: options.path || options.url,
                flags: options.flags,
                urlParamPattern: options.urlParamPattern,
                strict: self.strict
            }),
            spec: options,
            types: type,
            versions: versions
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
    public unmount(route: any) {

    }
    public find(req, res, next) {

    }
    public get(name, req, next) {

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

    let params: string[] = []
    let pattern = '^'
    let re
    let _url = url.parse(options.url).pathname as string
    _url.split('/').forEach(function (frag) {
        if (frag.length <= 0) {
            return false
        }

        pattern += '\\/+'

        if (frag.charAt(0) === ':') {
            let label = frag
            let index = frag.indexOf('(')
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
