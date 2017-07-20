import * as chai from "chai";
const should = chai.should()
const expect = chai.expect

import * as restifyErrors from 'restify-errors'
import Response from './response'
import Request from './request'
import { LamdaCallback } from './lamda_callback'
import { EventSource, PartialEventSource } from './event_source'
const sampleEventSource: EventSource = require('../../tests/data/sample_event_source')

function createRequestModel(customEventSource?: PartialEventSource): Request {
    const eventSource = Object.assign({}, sampleEventSource, customEventSource || {})
    return new Request(eventSource)
}

function createModel(lamdaCallback?: LamdaCallback, customEventSource?: PartialEventSource): Response {
    if (!lamdaCallback) {
        lamdaCallback = function (error, result) {

        } as LamdaCallback
    }
    return new Response(lamdaCallback, createRequestModel(customEventSource))
}

describe('Response', function () {

    let model: Response
    let modelResponse: any

    function setupNewModel(customEventSource?: PartialEventSource) {
        model = createModel(function (error, result) {
            modelResponse = { error, result }
        } as LamdaCallback, customEventSource)
    }

    beforeEach(() => {
        setupNewModel()
    })

    function testSuccessModelResponse() {
        expect(modelResponse).to.be.an('object').with.property('error', null)
        expect(modelResponse).to.be.an('object').with.property('result')
        expect(modelResponse.result).to.be.an('object')
    }
    function testHeaderInModelResponse(name: string, value?: any) {
        testSuccessModelResponse()
        let t = expect(modelResponse.result.headers).to.be.an('object')
        if(value) {
            t.with.property(name, value)
        }
        else {
            t.with.property(name)
        }
    }
    function testStatusCodeInModelResponse(code: number) {
        testSuccessModelResponse()
        modelResponse.result.should.have.property('statusCode', code + '')
    }
    function testBodyInModelResponse(body: string, contentType?: string, contentLength?: number) {
        testSuccessModelResponse()
        modelResponse.result.should.have.property('body', body)
        if (contentType !== undefined) {
            expect(modelResponse.result.headers).to.be.an('object').with.property('content-type', contentType)
        }
        if (contentLength !== undefined) {
            expect(modelResponse.result.headers).to.be.an('object').with.property('content-length', contentLength)
        }
    }

    describe('header', function () {
        it('should set header if value provided', function () {
            model.header('abc', 'cba')
            model.send()
            testHeaderInModelResponse('abc', 'cba')
        })
        it('should return current value if no new value provided', function () {
            model.header('abc', 'cba')
            should.equal(model.header('abc'), 'cba')
        })
        it('should handle date as value', function () {
            const date = new Date()
            model.header('date', date)
            model.send()
            testHeaderInModelResponse('date', date.toUTCString())
        })
        it('should handle multiple value header types', function () {
            model.header('a', 'a1')
            model.header('a', 'a2')
            model.send()
            testHeaderInModelResponse('a', 'a1,a2')
        })
        it('should handle exceptions in multiple value headers', function () {
            model.header('set-cookie', 'c1=v1')
            model.header('set-cookie', 'c2=v2')
            model.send()
            testHeaderInModelResponse('set-cookie', 'c2=v2')
        })
        it('should support sprintf syntax', function () {
            (model.header as any)('a', 'av %s', 'some')
            model.send()
            testHeaderInModelResponse('a', 'av some')
        })
    })

    describe('cache', function () {
        it('should use default value of public', function () {
            model.cache()
            model.send()
            testHeaderInModelResponse('cache-control', 'public')
        })
        it('should use options', function () {
            model.cache({ maxAge: 3600 })
            model.send()
            testHeaderInModelResponse('cache-control', 'public, max-age=3600')
        })
        it('should work with both args', function () {
            model.cache('private', { maxAge: 3600 })
            model.send()
            testHeaderInModelResponse('cache-control', 'private, max-age=3600')
        })
    })
    describe('noCache', function () {
        it('should set various no cache headers', function () {
            model.noCache()
            model.send()
            testHeaderInModelResponse('cache-control', 'no-cache, no-store, must-revalidate')
            testHeaderInModelResponse('pragma', 'no-cache')
            testHeaderInModelResponse('expires', '0')
        })
    })
    describe('getHeaders', function () {
        it('should return all headers', function () {
            model.header('a', 'av')
            model.header('b', 'b1')
            model.header('b', 'b2')
            const headers = model.getHeaders()
            expect(headers).to.be.an('object').with.property('a', 'av')
            headers.should.have.property('b', 'b1,b2')
        })
    })
    describe('removeHeader', function () {
        it('should remove header', function () {
            model.header('a', 'av')
            model.removeHeader('a')
            expect(model.header('a')).to.be.undefined
        })
    })
    describe('writeHead', function () {
        it('should set status code', function () {
            model.writeHead(404)
            model.send()
            testStatusCodeInModelResponse(404)
        })
        it('should set additional headers if passed', function () {
            model.header('a', 'a1')
            model.header('b', 'b1')
            model.writeHead(201, {
                a: 'a2',
                c: 'c1'
            })
            model.send()
            testStatusCodeInModelResponse(201)
            testHeaderInModelResponse('a', 'a2')
            testHeaderInModelResponse('b', 'b1')
            testHeaderInModelResponse('c', 'c1')
        })
    })
    describe('write', function () {
        it('should write to body', function () {
            model.write('b')
            model.write('a')
            model.send()
            testBodyInModelResponse('ba')
        })
    })
    describe('link', function () {
        it('should set link header', function () {
            model.link('/p/1', 'first')
            model.link('/p/10', 'last')
            model.send()
            testHeaderInModelResponse('link', '</p/1>; rel="first",</p/10>; rel="last"')
        })
    })
    describe('charSet', function () {
        it('should charset of content-type header', function () {
            model.charSet('utf-8')
            model.header('content-type', 'text/html')
            model.send('some')
            testHeaderInModelResponse('content-type', 'text/html; charset=utf-8')
        })
    })
    describe('status', function () {
        it('should set status code', function () {
            model.status(404)
            model.send()
            testStatusCodeInModelResponse(404)
        })
    })
    describe('set', function () {
        it('should set header - name,value', function () {
            model.set('a', 'a1')
            model.send()
            testHeaderInModelResponse('a', 'a1')
        })
        it('should set header - object', function () {
            model.set({
                a: 'a1',
                b: 'b1'
            })
            model.send()
            testHeaderInModelResponse('a', 'a1')
            testHeaderInModelResponse('b', 'b1')
        })
    })
    describe('getHeaderNames', function () {
        it('should return array of all header names lower cased', function () {
            model.set({
                a: 'a1',
                B: 'b1'
            })
            const names = model.getHeaderNames()
            expect(names).to.have.same.members(['a', 'b'])
        })
    })
    describe('hasHeader', function () {
        it('should check if header exists', function () {
            model.header('a', 'a1')
            should.equal(model.hasHeader('a'), true)
            should.equal(model.hasHeader('b'), false)
        })
    })
    describe('send', function () {
        it('should auto format body based on content-type', function () {
            model.header('content-type', 'json')
            model.send({ a: 23 })
            testBodyInModelResponse('{"a":23}', 'application/json', Buffer.byteLength('{"a":23}'))
        })
        it('should fallback on request accepts header if we dont set content type', function () {
            model.send({ a: 23 })
            testBodyInModelResponse('[object Object]', 'text/html', Buffer.byteLength('[object Object]'))

            setupNewModel({
                headers: Object.assign({}, sampleEventSource.headers,
                    {
                        Accept: 'application/json'
                    })
            })

            model.send({ a: 24 })
            testBodyInModelResponse('{"a":24}', 'application/json', Buffer.byteLength('{"a":24}'))
        })
        it('should respect previous write', function () {
            model.write('a')
            model.send('b')
            testBodyInModelResponse('ab')
        })
        it('should accept code as first arg', function () {
            model.send(201, 'some')
            testStatusCodeInModelResponse(201)
            testBodyInModelResponse('some')
        })
        it('should handle error as body', function () {
            model.header('content-type', 'json')
            model.send(new restifyErrors.InvalidArgumentError('id'))
            testBodyInModelResponse('{"code":"InvalidArgument","message":"id"}')
            testStatusCodeInModelResponse(409)

            setupNewModel()
            model.send(new restifyErrors.InvalidArgumentError('id'))
            testBodyInModelResponse('InvalidArgumentError: id')
            testStatusCodeInModelResponse(409)
        })
    })
    describe('json', function () {
        it('should handle json response', function () {
            model.json({ a: 23 })
            testBodyInModelResponse('{"a":23}', 'application/json', Buffer.byteLength('{"a":23}'))
        })
    })
    describe('redirect', function () {
        it('should handle url redirect', function () {
            model.redirect('/some/url')
            testStatusCodeInModelResponse(302)
            testBodyInModelResponse('', undefined, 0)
            testHeaderInModelResponse('location', '/some/url')
        })
        it('should handle url options object', function () {
            model.redirect({
                hostname: 'www.foo.com',
                pathname: '/bar',
                secure: true,             // sets https
                permanent: true,
                query: {
                    a: 1
                }
            })
            testStatusCodeInModelResponse(301) // permanent
            testBodyInModelResponse('', undefined, 0)
            testHeaderInModelResponse('location', 'https://www.foo.com/bar?a=1')
        })
    })
    describe('end', function() {
        it('should send all the data pushed using writeHead, write and headers', function() {
            model.header('a', 'a1')
            model.writeHead(201, {
                b: 'b1'
            })
            model.write('1')
            model.write('2')
            model.end()
            testStatusCodeInModelResponse(201)
            testBodyInModelResponse('12')
            testHeaderInModelResponse('a', 'a1')
            testHeaderInModelResponse('b', 'b1')
        })
    })
    describe('finished', function() {
        it('should be set to false before and true after end is called', function() {
            should.equal(model.finished, false)
            model.send()
            should.equal(model.finished, true)
        })
    })
    describe('headersSent', function() {
        it('should be set to false before and true after end is called', function() {
            should.equal(model.headersSent, false)
            model.send()
            should.equal(model.headersSent, true)
        })
    })
    describe('sendDate', function() {
        it('should send date header if true', function() {
            // default is true
            model.send()
            testHeaderInModelResponse('date')
            
            setupNewModel()
            model.sendDate = false
            model.send()
            testSuccessModelResponse()
            modelResponse.result.headers.should.not.have.property('date')
        })
    })

})