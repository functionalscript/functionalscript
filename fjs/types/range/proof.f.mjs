import { contains, one } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    contains: () => {
        assert(contains(0, 5)(1), 1)
        assert(contains(0, 5)(0), 0)
        assert(contains(0, 5)(5), 5)
        assert(!(contains(0, 5)(-1)), -1)
        assert(!(contains(0, 5)(6)), 6)
    },
    // a range of one value: both ends are it, and only it is contained
    one: () => {
        const [b, e] = one(7)
        assertEq(b, 7)
        assertEq(e, 7)
        assert(contains(b, e)(7), 7)
        assert(!contains(b, e)(6), 6)
    },
}
