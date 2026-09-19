import { assertEq } from '../asserts/module.f.mjs'
import { percentDecode } from './module.f.mjs'

export const proof = {
    plain: () => assertEq(percentDecode('a/b'), 'a/b'),
    ascii: () => assertEq(percentDecode('a%20b'), 'a b'),
    utf8: () => assertEq(percentDecode('%D0%9F'), 'П'),
    malformed: () => {
        assertEq(percentDecode('%'), null)
        assertEq(percentDecode('%zz'), null)
        assertEq(percentDecode('%ff'), null)
    },
}
