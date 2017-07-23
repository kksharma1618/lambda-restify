import formatters from './formatters'
import * as assert from 'assert-plus'
import * as mime from 'mime'

export function createHttpError(msg: string, code: number) {
    let e = new Error(msg);
    (e as any).statusCode = code
    return e
}
export function httpDate(now?) {
    if (!now) {
        now = new Date()
    }
    return now.toUTCString()
}

export function createFormattersAndAcceptables(fmt?) {
    let arr: any[] = [];
    let obj = {};

    function addFormatter(src, k) {
        assert.func(src[k], 'formatter');

        let q = 1.0; // RFC 2616 sec14 - The default value is q=1
        let t = k;

        if (k.indexOf(';') !== -1) {
            let tmp = k.split(/\s*;\s*/);
            t = tmp[0];

            if (tmp[1].indexOf('q=') !== -1) {
                q = parseFloat(tmp[1].split('=')[1]);
            }
        }

        if (k.indexOf('/') === -1) {
            k = mime.lookup(k);
        }

        obj[t] = src[k];
        arr.push({
            q: q,
            t: t
        });
    }

    Object.keys(formatters).forEach(addFormatter.bind(null, formatters))
    Object.keys(fmt || {}).forEach(addFormatter.bind(null, fmt || {}))

    arr = arr.sort(function (a, b) {
        return (b.q - a.q)
    }).map(function (a) {
        return (a.t)
    })

    return ({
        formatters: obj,
        acceptable: arr
    })
}
export function shallowCopy(obj) {
    if (!obj) {
        return (obj);
    }
    var copy = {};
    Object.keys(obj).forEach(function (k) {
        copy[k] = obj[k];
    });
    return (copy);
}
export function mergeQs(obj1, obj2) {

    var merged = shallowCopy(obj1) || {};

    // defend against null cause null is an object. yay js.
    if (obj2 && typeof (obj2) === 'object') {
        Object.keys(obj2).forEach(function (key) {
            // if we already have this key and it isn't an array,
            // make it one array of the same element.
            if (merged.hasOwnProperty(key) && !(merged[key] instanceof Array)) {
                merged[key] = [merged[key]];

                // push the new value down
                merged[key].push(obj2[key]);
            } else {
                // otherwise just set it
                merged[key] = obj2[key];
            }
        });
    }

    return (merged);
}
/**
 * Headers that cannot be multi-values.
 * @see #779, don't use comma separated values for set-cookie
 * @see #986, don't use comma separated values for content-type
 * @see http://tools.ietf.org/html/rfc6265#section-3
 */
export const HEADER_ARRAY_BLACKLIST = {
    'set-cookie': true,
    'content-type': true
}