import * as qs from 'querystring'
import {InvalidContentError} from 'restify-errors'

export default function(req, res, next) {
    req.rawBody = req.body
    if (!req.body) {
        return next()
    }
    const contentType = req.header('content-type')
    if (!contentType) {
        return next()
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
        req.body = qs.parse(req.rawBody)
    } else if (contentType.includes('application/json')) {
        try {
            req.body = JSON.parse(req.rawBody)
        } catch (e) {
            return next(new InvalidContentError('Invalid JSON: ' + e.message))
        }
    }
    next()
}
