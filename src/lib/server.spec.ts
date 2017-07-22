import * as chai from "chai";
const should = chai.should()
const expect = chai.expect

import * as restifyErrors from 'restify-errors'
import Response from './response'
import Request from './request'
import Server from './server'
import { ServerOptions } from './server_options'
import { LamdaCallback } from './lamda_callback'
import { EventSource, PartialEventSource, httpMethod } from './event_source'
const sampleEventSource: EventSource = require('../../tests/data/sample_event_source')
import Logger from './logger'
import * as errors from 'restify-errors'
import * as utils from './utils'

let responseError, response

function createModel(serverOptions?: ServerOptions): Server {
    return new Server(Object.assign({}, {
        logLevel: Logger.DEBUG
    }, serverOptions))
}
function createEventSource(customEventSource?: PartialEventSource) {
    if (customEventSource && customEventSource.headers) {
        customEventSource.headers = Object.assign({}, sampleEventSource.headers, customEventSource.headers)
    }
    return Object.assign({}, sampleEventSource, customEventSource || {})
}
function createLamdaCallback(next?) {
    return function (error, result) {
        responseError = error
        response = result
        if (next) {
            next(error, result)
        }
    } as LamdaCallback
}
function triggerRequest(server: Server, customEventSource?: PartialEventSource, onResponse?) {
    server.handleLamdaEvent(createEventSource(customEventSource), createLamdaCallback(onResponse))
}


describe('Server', function () {

    let server: Server
    beforeEach(function () {
        server = createModel()
    })

    function testSuccessModelResponse() {
        expect(responseError).to.be.null
        expect(response).to.be.an('object')
    }
    function testHeaderInModelResponse(name: string, value?: any) {
        testSuccessModelResponse()
        let t = expect(response.headers).to.be.an('object')
        if (value) {
            t.with.property(name, value)
        }
        else {
            t.with.property(name)
        }
    }
    function testStatusCodeInModelResponse(code: number) {
        testSuccessModelResponse()
        response.should.have.property('statusCode', code + '')
    }
    function testBodyInModelResponse(body: string, contentType?: string, contentLength?: number) {
        testSuccessModelResponse()
        response.should.have.property('body', body)
        if (contentType !== undefined) {
            expect(response.headers).to.be.an('object').with.property('content-type', contentType)
        }
        if (contentLength !== undefined) {
            expect(response.headers).to.be.an('object').with.property('content-length', contentLength)
        }
    }
    async function makeRequest(url, method: httpMethod = 'GET', headers: any = {}, body = '') {
        return await utils.promiseFromCallback<any>(function (next) {
            triggerRequest(server, {
                body: body,
                headers: headers,
                httpMethod: method,
                path: url
            }, next)
        })
    }

    describe('pre', function () {
        it('should register pre handler', function (done) {
            server.pre(function (req, res, next) {
                (req as any).someValue = 23
                return next()
            })
            server.get('/r1', function (req, res) {
                should.equal((req as any).someValue, 23)
                done()
            })
            triggerRequest(server, {
                path: "/r1",
                httpMethod: "GET"
            })
        })
        it('should register multiple pre handler', function (done) {
            server.pre(function (req, res, next) {
                (req as any).someValue = 23
                return next()
            }, function (req, res, next) {
                (req as any).someOtherValue = 24
                return next()
            })
            server.get('/r1', function (req, res) {
                should.equal((req as any).someValue, 23)
                should.equal((req as any).someOtherValue, 24)
                done()
            })
            triggerRequest(server, {
                path: "/r1",
                httpMethod: "GET"
            })
        })
        it('prerouting - pre handler throws error', function (done) {
            server.pre(function (req, res, next) {
                next(new errors.BadRequestError('abc'))
            })
            server.get('/r1', function (req, res) {
                chai.assert.notOk("Should not have reached")
            })
            triggerRequest(server, {
                path: "/r1",
                httpMethod: "GET"
            }, function () {
                testStatusCodeInModelResponse(400)
                testBodyInModelResponse('BadRequestError: abc')
                done()
            })

        })
        it('prerouting - handlers should be fired even if no route was selected', function (done) {
            server.pre(function (req, res, next) {
                next()
            })
            triggerRequest(server, {
                path: 'nosuchpath'
            }, function () {
                testStatusCodeInModelResponse(404)
                done()
            })
        })
        it('prerouting - next(false) should skip the remaining handlers', function (done) {
            server.pre(function (req, res, next) {
                res.send('some')
                next(false)
            })
            server.get('/some/path', function (req, res, next) {
                chai.assert.notOk('Should not be reached')
            })
            triggerRequest(server, {
                path: '/some/path'
            }, function () {
                testStatusCodeInModelResponse(200)
                testBodyInModelResponse('some')
                done()
            })
        })
    })

    describe('use', function () {
        it('should register handler', function (done) {
            server.use(function (req, res, next) {
                (req as any).someValue = 23
                return next()
            })
            server.get('/r1', function (req, res) {
                should.equal((req as any).someValue, 23)
                done()
            })
            triggerRequest(server, {
                path: "/r1",
                httpMethod: "GET"
            })
        })
        it('should register multiple handler', function (done) {
            server.use(function (req, res, next) {
                (req as any).someValue = 23
                return next()
            }, function (req, res, next) {
                (req as any).someOtherValue = 24
                return next()
            })
            server.get('/r1', function (req, res) {
                should.equal((req as any).someValue, 23)
                should.equal((req as any).someOtherValue, 24)
                done()
            })
            triggerRequest(server, {
                path: "/r1",
                httpMethod: "GET"
            })
        })
        it('handler should run after pre handlers', function (done) {
            server.use(function (req, res, next) {
                should.equal((req as any).someValue, 23)
                next()
            })
            server.pre(function (req, res, next) {
                (req as any).someValue = 23
                next()
            })
            server.get('/r1', function (req, res) {
                done()
            })
            triggerRequest(server, {
                path: "/r1",
                httpMethod: "GET"
            })
        })
        it('handler should only run when route has matched', function (done) {
            server.use(function (req, res, next) {
                chai.assert.notOk('should not have reached')
                next()
            })
            triggerRequest(server, {
                path: "nosuchpath",
                httpMethod: "GET"
            })
            setTimeout(done, 20)
        })
    })

    describe('params support', function () {
        it('should match and provide params', function (done) {
            server.get('/users/:id/:task', function (req, res, next) {
                res.send(req.params.id + ':' + req.params.task)
            })
            triggerRequest(server, {
                path: '/users/23/delete',
                httpMethod: 'GET'
            }, function () {
                testBodyInModelResponse('23:delete')
                done()
            })
        })
    })
    describe('version support', function () {
        it('should allow different version to coexist', async () => {
            server.get({ path: '/vr', version: '1.1.3' }, function (req, res) {
                res.send('1.1.3')
            })
            server.get({ path: '/vr', version: '2.0.1' }, function (req, res) {
                res.send('2.0.1')
            })

            await makeRequest('/vr', 'GET', {
                'accept-version': '~1'
            })
            testBodyInModelResponse('1.1.3')

            await makeRequest('/vr', 'GET', {
                'accept-version': '~2'
            })
            testBodyInModelResponse('2.0.1')
        })

        it('should throw version error if no valid one exist', async () => {
            server.get({ path: '/vr', version: '1.1.3' }, function (req, res) {
                res.send('1.1.3')
            })
            const response = await makeRequest('/vr', 'GET', {
                'accept-version': '~2'
            })
            testStatusCodeInModelResponse(400)
            response.should.have.property('body')
            response.body.should.include('InvalidVersionError')
        })
        it('should use latest once if no version specified', async () => {
            server.get({ path: '/vr', version: '1.1.3' }, function (req, res) {
                res.send('1.1.3')
            })
            server.get({ path: '/vr', version: '2.0.1' }, function (req, res) {
                res.send('2.0.1')
            })

            await makeRequest('/vr')
            testBodyInModelResponse('2.0.1')
        })
    })
})