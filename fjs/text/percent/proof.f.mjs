import { assertEq } from '../../asserts/module.f.mjs'
import { percentDecode } from './module.f.mjs'

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
}
