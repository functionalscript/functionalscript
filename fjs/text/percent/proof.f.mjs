import { assertEq } from '../../asserts/module.f.js'
import { encodeURIComponent as encodeUriComponent, percentDecode, percentEncodeComponent, percentEncodePath } from './module.f.js'
import { unwrap } from '../../types/nullable/module.f.js'
import { codeUnitToString } from '../utf16/module.f.js'

export const proof = {
    empty: () => assertEq(percentDecode(''), ''),
    plain: () => assertEq(percentDecode('a/b'), 'a/b'),
    ascii: () => assertEq(percentDecode('a%20b'), 'a b'),
    utf8: () => assertEq(percentDecode('%D0%9F'), 'П'),
    hexCase: () => {
        assertEq(percentDecode('%2f'), '/')
        assertEq(percentDecode('%2F'), '/')
        assertEq(percentDecode('%d0%9f'), 'П')
    },
    malformed: () => {
        assertEq(percentDecode('%'), null)
        assertEq(percentDecode('%2'), null)
        assertEq(percentDecode('%g0'), null)
        assertEq(percentDecode('%zz'), null)
        assertEq(percentDecode('%2z'), null)
        assertEq(percentDecode('%ff'), null)
    },
    encodePath: {
        // Letters, digits, RFC 3986's other unreserved characters and `/` pass
        // through.
        unreserved: () => assertEq(percentEncodePath('/aZ09-._~/'), '/aZ09-._~/'),
        // An escape is kept as it was spelled, hex case included, rather than
        // escaped again into `%251B`.
        escapes: () => {
            assertEq(percentEncodePath('/%1B%5B31m/'), '/%1B%5B31m/')
            assertEq(percentEncodePath('/%2f%d0%9F'), '/%2f%d0%9F')
        },
        // Every other byte is escaped: a control character, a space, a
        // reserved character, and each UTF-8 byte of a non-ASCII one.
        others: () => {
            assertEq(percentEncodePath('/\x1B[31m/'), '/%1B%5B31m/')
            assertEq(percentEncodePath('/a\nb c?#'), '/a%0Ab%20c%3F%23')
            assertEq(percentEncodePath('П%20П'), '%D0%9F%20%D0%9F')
        },
        // Whatever it writes decodes to what it was given.
        roundTrip: () => {
            /** @type {(s: string) => void} */
            const same = s => assertEq(percentDecode(percentEncodePath(s) ?? ''), percentDecode(s))
            same('/\x1B[31m/%41')
            same('П%2F?')
        },
        // What `percentDecode` refuses: a lone `%`, and a lone surrogate.
        refused: () => {
            assertEq(percentEncodePath('/a%'), null)
            assertEq(percentEncodePath('/a%zz'), null)
            assertEq(percentEncodePath('/\uD800'), null)
        },
    },
    encodeComponent: {
        // Letters, digits and RFC 3986's other unreserved characters pass
        // through.
        unreserved: () => assertEq(percentEncodeComponent('aZ09-._~'), 'aZ09-._~'),
        // A path's `/` and an escape's `%` are escaped like any other byte,
        // and so is each UTF-8 byte of a non-ASCII character.
        others: () => {
            assertEq(percentEncodeComponent('a/b%20c&d=e'), 'a%2Fb%2520c%26d%3De')
            assertEq(percentEncodeComponent('hello&雪'), 'hello%26%E9%9B%AA')
        },
        roundTrip: () => assertEq(percentDecode(unwrap(percentEncodeComponent('/\x1B[31m/%41 П'))), '/\x1B[31m/%41 П'),
        // A lone surrogate has no UTF-8 bytes, so there is nothing to encode.
        loneSurrogate: () => {
            assertEq(percentEncodeComponent('\uD800'), null)
            assertEq(percentEncodeComponent('a\uDC00'), null)
        },
    },
    encodeUriComponent: {
        empty: () => assertEq(encodeUriComponent(''), ''),
        // JavaScript's component encoder also leaves !*'() unescaped.
        ascii: () => {
            assertEq(encodeUriComponent("aZ09-_.!~*'()"), "aZ09-_.!~*'()")
            for (let code = 0; code < 0x80; code += 1) {
                const s = codeUnitToString(code)
                assertEq(encodeUriComponent(s), encodeURIComponent(s))
            }
        },
        unicode: () => {
            // UTF-8 width boundaries, both sides of the surrogate range,
            // and the first and last supplementary scalar values.
            const boundaries = /** @type {const} */ ([
                '\u007f', '\u0080', '\u07ff', '\u0800', '\ud7ff', '\ue000',
                '\uffff', '\ud800\udc00', '\udbff\udfff',
            ])
            for (const s of boundaries) {
                assertEq(encodeUriComponent(s), encodeURIComponent(s))
            }
            assertEq(encodeUriComponent('П/雪 😀'), '%D0%9F%2F%E9%9B%AA%20%F0%9F%98%80')
            assertEq(encodeUriComponent('a%20/😀\u0000雪!'), encodeURIComponent('a%20/😀\u0000雪!'))
        },
        coercion: () => {
            assertEq(encodeUriComponent(), 'undefined')
            const values = /** @type {const} */ ([
                undefined, null, true, false, 0, -0, 1.5, NaN, Infinity,
                -Infinity, 1n, -2n, [], [undefined, null],
                [1, 'a b', ['雪']], {}, { a: 1 },
            ])
            for (const value of values) {
                assertEq(encodeUriComponent(value), encodeURIComponent(String(value)))
            }
        },
        throw: {
            highSurrogate: () => encodeUriComponent('\ud800'),
            lowSurrogate: () => encodeUriComponent('\udfff'),
            reversedPair: () => encodeUriComponent('\udc00\ud800'),
            embeddedHigh: () => encodeUriComponent('a\ud800b'),
            embeddedLow: () => encodeUriComponent('a\udc00b'),
            failedCoercion: () => encodeUriComponent({ toString: 0, valueOf: 0 }),
        },
    },
}
