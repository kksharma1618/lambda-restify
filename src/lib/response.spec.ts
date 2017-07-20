import * as chai from "chai";
const should = chai.should()
const expect = chai.expect

import Response from './response'
import Request from './request'
import { LamdaCallback } from './lamda_callback'
import {EventSource, PartialEventSource} from './event_source'
const sampleEventSource: EventSource = require('../../tests/data/sample_event_source')

function createRequestModel(customEventSource?: PartialEventSource) : Request {
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
    beforeEach(() => {
        model = createModel(function (error, result) {
            modelResponse = { error, result }
        } as LamdaCallback)
    })

    function testSuccessModelResponse() {
        expect(modelResponse).to.be.an('object').with.property('error', null)
        expect(modelResponse).to.be.an('object').with.property('result')
        expect(modelResponse.result).to.be.an('object')
    }
    function testHeaderInModelResponse(name: string, value: string) {
        testSuccessModelResponse()
        expect(modelResponse.result.headers).to.be.an('object').with.property(name, value)
    }
    function testStatusCodeInModelResponse(code: number) {
        testSuccessModelResponse()
        modelResponse.result.should.have.property('statusCode', code+'')
    }
    function testBodyInModelResponse(body: string) {
        testSuccessModelResponse()
        modelResponse.result.should.have.property('body', body)
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
    describe('getHeaders', function() {
        it('should return all headers', function() {
            model.header('a', 'av')
            model.header('b', 'b1')
            model.header('b', 'b2')
            const headers = model.getHeaders()
            expect(headers).to.be.an('object').with.property('a', 'av')
            headers.should.have.property('b', 'b1,b2')
        })
    })
    describe('removeHeader', function() {
        it('should remove header', function() {
            model.header('a', 'av')
            model.removeHeader('a')
            expect(model.header('a')).to.be.undefined
        })
    })
    describe('writeHead', function() {
        it('should set status code', function() {
            model.writeHead(404)
            model.send()
            testStatusCodeInModelResponse(404)
        })
        it('should set additional headers if passed', function() {
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
    describe('write', function() {
        it('should write to body', function() {
            model.write('b')
            model.write('a')  
            model.send()
            testBodyInModelResponse('ba')
        })
    })
    describe('link', function() {
        it('should set link header', function() {
            model.link('/p/1', 'first')
            model.link('/p/10', 'last')
            model.send()
            testHeaderInModelResponse('link', '</p/1>; rel="first",</p/10>; rel="last"')
        })
    })
    describe('charSet', function() {
        it('should charset of content-type header', function() {
            model.charSet('utf-8')
            model.header('content-type', 'text/html')
            model.send('some')
            testHeaderInModelResponse('content-type', 'text/html; charset=utf-8')
        })
    })
    describe('status', function() {
        it('should set status code', function() {
            model.status(404)
            model.send()
            testStatusCodeInModelResponse(404)
        })
    })
    describe('set', function() {
        it('should set header - name,value', function() {
            model.set('a', 'a1')
            model.send()
            testHeaderInModelResponse('a', 'a1')
        })
        it('should set header - object', function() {
            model.set({
                a: 'a1',
                b: 'b1'
            })
            model.send()
            testHeaderInModelResponse('a', 'a1')
            testHeaderInModelResponse('b', 'b1')
        })
    })
    describe('getHeaderNames', function() {
        it('should return array of all header names lower cased', function() {
            model.set({
                a: 'a1',
                B: 'b1'
            })
            const names = model.getHeaderNames()
            expect(names).to.have.same.members(['a', 'b'])
        })
    })
    describe('hasHeader', function() {
        it('should check if header exists', function() {
            model.header('a', 'a1')
            should.equal(model.hasHeader('a'), true)
            should.equal(model.hasHeader('b'), false)
        })
    })
    describe('send', function() {
        
    })
})