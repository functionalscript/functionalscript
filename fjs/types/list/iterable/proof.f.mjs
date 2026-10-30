import { iterable, toArray } from './module.f.mjs'
import { countdown } from '../module.f.mjs'
import { stringifySorted } from '../../../media/json/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.js'

export const proof = {
    iterable: () => {
        assertEq(stringifySorted([...iterable(countdown(3))]), '[2,1,0]')
        assertEq(stringifySorted([...iterable(null)]), '[]')
    },
    toArray: () => {
        /** @type {readonly number[]} */
        const a = [1, 2]
        assert(toArray(a) === a)
        assert(toArray(() => a) === a)
        assertEq(stringifySorted(toArray({ first: 1, tail: [2, 3] })), '[1,2,3]')
    },
}
