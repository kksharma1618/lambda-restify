import * as chai from "chai";
const should = chai.should();

import Request from './request'
import {EventSource, PartialEventSource} from './event_source'
const sampleEventSource: EventSource = require('../../tests/data/sample_event_source')
import Logger from './logger'
const log = new Logger()

function createModel(customEventSource?: PartialEventSource) : Request {
    const eventSource = Object.assign({}, sampleEventSource, customEventSource || {})
    return new Request(eventSource, log)
}

describe('Request', function() {

    let model: Request
    beforeEach(() => {
        model = createModel()
    })

    
    describe('accepts', function() {
        it('should work', function() {
            should.equal(model.accepts('html'), 'text/html')
            should.equal(model.accepts(['html', 'txt']), 'text/html')
            should.equal(model.accepts('txt'), undefined)
        })  
    })
    describe('acceptsEncoding', function() {
        it('should work', function() {
            should.equal(model.acceptsEncoding(['deflate', 'gzip']), 'gzip')
            should.equal(model.acceptsEncoding('gzip'), 'gzip')
            should.equal(model.acceptsEncoding('nope'), undefined)
        })
    })
    describe('getContentLength', function() {
        it('should return undefined when header not there', function() {
            should.equal(model.getContentLength(), undefined)
        })
        it('should return content length when header is there', function() {
            model.headers['content-length'] = '12'
            should.equal(model.getContentLength(), 12)
        })
        it('should have alias named contentLength', function() {
            model.should.have.property('contentLength').which.is.an('function')
        })
    })
    describe('getContentType', function() {
        it('should return application/octet-stream if header not there', function() {
            should.equal(model.getContentType(), 'application/octet-stream')
        })
        it('should return content type if header is there', function() {
            model.headers['content-type'] = 'text/plain'
            should.equal(model.getContentType(), 'text/plain')

            {
                const model = createModel()
                model.headers['content-type'] = 'text/html; charset=utf-8'
                should.equal(model.getContentType(), 'text/html')
            }
        })
        it('should have alias named contentType', function() {
            model.should.have.property('contentType').which.is.an('function')
        })
    })
    describe('time', function() {
        it('should return time when request object was setup', function() {
            chai.expect(model.time() - Date.now()).to.be.below(2)
        })
    })
    describe('date', function() {
        it('should return date when request object was setup', function() {
            chai.expect(model.date()).to.be.a('date')
            chai.expect(model.date().getTime() - Date.now()).to.be.below(2)
        })
    })
    describe('header', function() {
        it('should be case insensitive', function() {
            should.equal(model.header('x-Forwarded-pROTO'), 'https')
        })
        it('should return default value if no such header found', function() {
            should.equal(model.header('noSuchHeader', 'defaultValue'), 'defaultValue')
        })
    })
    describe('headers', function() {
        it('should have public headers field', function() {
            model.should.have.property('headers').which.is.an('object')
            model.headers.should.have.property('x-forwarded-proto', 'https')
        })
    })
    describe('getQuery', function() {
        it('should return empty object if no query string there', function() {
            let model = createModel()
            model.url = '/path/to/resource'
            chai.expect(model.getQuery()).to.be.an('object')
            Object.keys(model.getQuery()).should.be.an('array').with.length(0)
        })
        it('should return query object', function() {
            chai.expect(model.getQuery()).to.be.an('object')
            chai.expect(model.getQuery()).to.have.property('foo', 'bar')
        })
        it('should have alias named query', function() {
            model.should.have.property('query').which.is.an('function')
        })
    })
    describe('href', function() {
        it('should return full path', function() {
            should.equal(model.href(), '/path/to/resource?foo=bar')
        })
    })
    describe('id', function() {
        it('should return an id if no arg is passed', function() {
            chai.expect(model.id()).to.be.a('string').which.is.not.equal('')
        })
        it('should set id when arg is passed', function() {
            model.id('someid')
            should.equal(model.id(), 'someid')
        })
        it('should throw error if you set id when its already there', function() {
            model.id("someid")
            try {
                model.id("otherid")
                chai.assert(false, "should have thrown error")
            }
            catch(e) {
            }
        })
    })
    describe('getId', function() {
        it('should return random id if nothing set', function() {
            chai.expect(model.getId()).to.be.a('string').which.is.not.equal('')
        })
        it('should return id which was set using request.id function', function() {
            model.id('someid')
            should.equal(model.getId(), 'someid')
        })
    })
    describe('getPath', function() {
        it('should return path without query', function() {
            should.equal(model.getPath(), '/path/to/resource')
        })
        it('should have an alias path', function() {
            model.should.have.property('path').which.is.an('function')
        })
    })
    describe('is', function() {
        it('should return false without content type header', function() {
            should.equal(model.is('html'), false)
        })
        it('should work with proper header', function() {
            model.headers['content-type'] = 'text/html; charset=utf-8'
            should.equal(model.is('html'), true)
            should.equal(model.is('text/html'), true)
            should.equal(model.is('json'), false)
            should.equal(model.is('application/json'), false)
        })
    })
    describe('userAgent', function() {
        it('should work', function() {
            should.equal(model.userAgent(), 'Custom User Agent String')
        })
    })

})