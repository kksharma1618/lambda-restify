import * as qs from 'querystring'
import {InvalidContentError} from 'restify-errors'

export default function(req, res, next) {
    req.rawBody = req.body
    if (!req.body) {
        return next()
    }
    let contentType = req.header('content-type')
    if (!contentType) {
        return next()
    }
    const jsonPatternMatcher = new RegExp('^application/[a-zA-Z.]+\\+json');
    // map any +json to application/json
    if (jsonPatternMatcher.test(contentType)) {
        contentType = 'application/json';
    }

    switch (contentType) {
        case 'application/x-www-form-urlencoded':
            req.body = qs.parse(req.rawBody)
            break
        case 'application/json':
            try {
                req.body = JSON.parse(req.rawBody)
            } catch (e) {
                return next(new InvalidContentError('Invalid JSON: ' + e.message))
            }
            break
    }
    next()
}
