import * as qs from 'querystring'
import {InvalidContentError} from 'restify-errors'

export default function (req, res, next) {
    req.rawBody = req.body
    if(!req.body) {
        return next()
    }
    const contentType = req.header('content-type')
    if(!contentType) {
        return next()
    }
    switch(contentType) {
        case 'application/x-www-form-urlencoded':
            // d[]=2&d[]=3 => d=2&d=3 
            // both will be parsed as d: [2,3]
            req.rawBody = req.rawBody.replace(/\[\]=/g, '=')
            req.body = qs.parse(req.rawBody)
        break
        case 'application/json':
            try {
                req.body = JSON.parse(req.rawBody)
            }
            catch(e) {
                return next(new InvalidContentError('Invalid JSON: '+e.message))
            }
        break
    }
    next()
}