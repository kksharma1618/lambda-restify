import {EventSource} from './event_source'
import assert from 'assert-plus'

export class Request {
    constructor(private source: EventSource) {
    }
    public header(name, value) {
        assert.string(name, 'name')
        name = name.toLowerCase()

        if (name === 'referer' || name === 'referrer') {
            name = 'referer'
        }

        return this.source.headers[name] || value
    }
}