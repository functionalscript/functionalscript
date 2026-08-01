import { contains } from './module.f.ts'
import { assert } from '../../asserts/module.f.mjs'

export const proof = () => {
    assert(contains(0, 5)(1), 1)
    assert(contains(0, 5)(0), 0)
    assert(contains(0, 5)(5), 5)
    assert(!(contains(0, 5)(-1)), -1)
    assert(!(contains(0, 5)(6)), 6)
}
