import * as chai from "chai";
const should = chai.should();

import Request from './request'
import {EventSource, PartialEventSource} from './event_source'
const sampleEventSource: EventSource = require('../../tests/data/sample_event_source')
import Logger from './logger'
const log = new Logger()

function createModel(customEventSource?: PartialEventSource) {
    const eventSource = Object.assign({}, sampleEventSource, customEventSource || {})
    return new Request(eventSource, log)
}

describe('Request', () => {

    let model: Request
    beforeEach(() => {
        model = createModel()
    })

    describe('accepts', () => {
        it('should work', () => {
            should.equal(model.accepts('html'), 'text/html')
            should.equal(model.accepts(['html', 'txt']), 'text/html')
            should.equal(model.accepts('txt'), undefined)
        })
    })
    describe('acceptsEncoding', () => {
        it('should work', () => {
            should.equal(model.acceptsEncoding(['deflate', 'gzip']), 'gzip')
            should.equal(model.acceptsEncoding('gzip'), 'gzip')
            should.equal(model.acceptsEncoding('nope'), undefined)
        })
    })
    describe('getContentLength', () => {
        it('should return undefined when header not there', () => {
            should.equal(model.getContentLength(), undefined)
        })
        it('should return content length when header is there', () => {
            model.headers['content-length'] = '12'
            should.equal(model.getContentLength(), 12)
        })
        it('should have alias named contentLength', () => {
            model.should.have.property('contentLength').which.is.an('function')
        })
    })
    describe('getContentType', () => {
        it('should return application/octet-stream if header not there', () => {
            should.equal(model.getContentType(), 'application/octet-stream')
        })
        it('should return content type if header is there', () => {
            model.headers['content-type'] = 'text/plain'
            should.equal(model.getContentType(), 'text/plain')

            {
                model = createModel()
                model.headers['content-type'] = 'text/html; charset=utf-8'
                should.equal(model.getContentType(), 'text/html')
            }
        })
        it('should have alias named contentType', () => {
            model.should.have.property('contentType').which.is.an('function')
        })
    })
    describe('time', () => {
        it('should return time when request object was setup', () => {
            chai.expect(model.time() - Date.now()).to.be.below(2)
        })
    })
    describe('date', () => {
        it('should return date when request object was setup', () => {
            chai.expect(model.date()).to.be.a('date')
            chai.expect(model.date().getTime() - Date.now()).to.be.below(2)
        })
    })
    describe('header', () => {
        it('should be case insensitive', () => {
            should.equal(model.header('x-Forwarded-pROTO'), 'https')
        })
        it('should return default value if no such header found', () => {
            should.equal(model.header('noSuchHeader', 'defaultValue'), 'defaultValue')
        })
    })
    describe('headers', () => {
        it('should have public headers field', () => {
            model.should.have.property('headers').which.is.an('object')
            model.headers.should.have.property('x-forwarded-proto', 'https')
        })
    })
    describe('getQuery', () => {
        it('should return empty object if no query string there', () => {
            model = createModel()
            model.url = '/path/to/resource'
            chai.expect(model.getQuery()).to.be.an('object')
            Object.keys(model.getQuery()).should.be.an('array').with.length(0)
        })
        it('should return query object', () => {
            chai.expect(model.getQuery()).to.be.an('object')
            chai.expect(model.getQuery()).to.have.property('foo', 'bar')
        })
        it('should have alias named query', () => {
            model.should.have.property('query').which.is.an('function')
        })
    })
    describe('href', () => {
        it('should return full path', () => {
            should.equal(model.href(), '/path/to/resource?foo=bar')
        })
    })
    describe('id', () => {
        it('should return an id if no arg is passed', () => {
            chai.expect(model.id()).to.be.a('string').which.is.not.equal('')
        })
        it('should set id when arg is passed', () => {
            model.id('someid')
            should.equal(model.id(), 'someid')
        })
        it('should throw error if you set id when its already there', () => {
            model.id("someid")
            try {
                model.id("otherid")
                chai.assert(false, "should have thrown error")
            } catch (e) {
            }
        })
    })
    describe('getId', () => {
        it('should return random id if nothing set', () => {
            chai.expect(model.getId()).to.be.a('string').which.is.not.equal('')
        })
        it('should return id which was set using request.id function', () => {
            model.id('someid')
            should.equal(model.getId(), 'someid')
        })
    })
    describe('getPath', () => {
        it('should return path without query', () => {
            should.equal(model.getPath(), '/path/to/resource')
        })
        it('should have an alias path', () => {
            model.should.have.property('path').which.is.an('function')
        })
    })
    describe('is', () => {
        it('should return false without content type header', () => {
            should.equal(model.is('html'), false)
        })
        it('should work with proper header', () => {
            model.headers['content-type'] = 'text/html; charset=utf-8'
            should.equal(model.is('html'), true)
            should.equal(model.is('text/html'), true)
            should.equal(model.is('json'), false)
            should.equal(model.is('application/json'), false)
        })
    })
    describe('userAgent', () => {
        it('should work', () => {
            should.equal(model.userAgent(), 'Custom User Agent String')
        })
    })

})