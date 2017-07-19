import * as chai from "chai";
const should = chai.should()
const expect = chai.expect

import Response from './response'
import { LamdaCallback } from './lamda_callback'

function createModel(lamdaCallback?: LamdaCallback): Response {
    if (!lamdaCallback) {
        lamdaCallback = function (error, result) {

        } as LamdaCallback
    }
    return new Response(lamdaCallback)
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
    }
    function testHeaderInModelResponse(name: string, value: string) {
        testSuccessModelResponse()
        expect(modelResponse.result.headers).to.be.an('object').with.property(name, value)
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
})