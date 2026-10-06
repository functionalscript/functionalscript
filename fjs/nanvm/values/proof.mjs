/**
 * Compile the native harness's interpreted value through the JavaScript
 * runtime boundary too. Ordinary calls and thrown payloads are host behavior;
 * the sibling pure proof checks the represented interpreter results.
 */

import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { toUnknown } from '../../edag/value/to_unknown/module.f.mjs'
import { javascriptOperationMap } from '../../edag/value/to_unknown/module.mjs'
import { asyncRun } from '../../effects/module.mjs'
import { isObject } from '../../types/object/module.f.mjs'
import { value } from './module.f.mjs'

export const proof = {
    nestedCaptures: async () => {
        const exports = assertOk(await asyncRun(javascriptOperationMap)(toUnknown(value())))
        assert(isObject(exports))
        const { make, shared } = exports
        assert(typeof make === 'function')
        const first = make(7)
        const second = make(7)
        assert(first !== second)
        const left = first(true)
        const right = second(true)
        assert(left[1] !== right[1])
        for (const [nested, result] of [[first, left], [second, right]]) {
            assertEq(nested.length, 1)
            assertEq('edag' in nested, false)
            const [captured, local, repeated] = result
            assertEq(captured, shared)
            assertEq(local, repeated)
            assertStructurallySame(local, [7])
            throws(() => nested(false), thrown => thrown === local)
            const afterFailure = nested(true)
            assert(afterFailure !== result)
            assertEq(afterFailure[0], shared)
            assertEq(afterFailure[1], local)
            assertEq(afterFailure[2], local)
        }
    },
}
