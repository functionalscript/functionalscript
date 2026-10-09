import { assertEq } from '../../asserts/module.f.mjs'
import { percentDecode, percentEncodePath } from './module.f.mjs'

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
}
