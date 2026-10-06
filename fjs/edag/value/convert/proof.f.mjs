/**
 * Primitive conversion keeps graph values represented and uses one function
 * spelling for explicit string conversion and nested array conversion.
 *
 * @import { Function as ValueFunction } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { toPrimitive, toString, toNumber } from './module.f.mjs'
import { tryFunctionText } from '../../../compiler/serializer/module.f.mjs'

/** @type {Invoke} */
const skipped = () => { assert(false, 'unexpected represented call') }
const undefinedValue = /** @type {const} */ (['undefined'])
const fn = /** @type {const} */ (['=>', 0, [], 5])
const failed = error(/** @type {const} */ (['{}', [[':', 'failure', 1]]]))

export const proof = {
    primitives: () => {
        for (const value of [undefinedValue, null, false, 0, -0, NaN, 4n, 'text']) {
            assertEq(Object.is(assertOk(toPrimitive(value, 'number', skipped)), value), true)
        }
        assertEq(assertOk(toString(undefinedValue, skipped)), 'undefined')
        assertEq(assertOk(toString(4n, skipped)), '4')
        assertEq(assertOk(toNumber(' 4 ', skipped)), 4)
        assertStructurallySame(assertError(toNumber(4n, skipped)), undefinedValue)
    },
    arrays: () => {
        const value = /** @type {const} */ (['[]', [null, undefinedValue, ['[]', [1, 2]], fn]])
        assertEq(assertOk(toString(value, skipped)), ',,1,2,()=>5')
        assertEq(assertOk(toPrimitive(value, 'number', skipped)), ',,1,2,()=>5')
        assertEq(assertOk(toNumber(['[]', [7]], skipped)), 7)
        assertEq(assertOk(toString(['[]', []], skipped)), '')
    },
    objects: () => {
        const own = /** @type {const} */ (['{}', [[':', 'toString', fn], [':', 'valueOf', fn]]])
        assertEq(assertOk(toString(['{}', []], skipped)), '[object Object]')
        assertEq(assertOk(toString(own, () => ok(8))), '8')
        assertEq(assertOk(toNumber(own, () => ok('9'))), 9)
        assertEq(toPrimitive(own, 'number', () => failed), failed)
        assertEq(toString(own, () => failed), failed)
        assertEq(toNumber(own, () => failed), failed)
        assertEq(toString(['[]', [own, own]], () => failed), failed)
    },
    functions: () => {
        /** @type {ValueFunction} */
        const closure = ['=>', 1, [7, 7, ['{}', []]], ['+', ['arg', 0], ['frame', 1]]]
        assertEq(assertOk(toString(closure, skipped)), '($a_0)=>$a_0+$1')
        assertEq(assertOk(toString(fn, skipped)), '()=>5')
        assertEq(Number.isNaN(assertOk(toNumber(fn, skipped))), true)
    },
    completeFunctionText: () => {
        /** @type {ValueFunction} */
        const optional = ['=>', 0, [], ['.', ['rest'], 'x', ['|?.()', []]]]
        const text = assertOk(tryFunctionText(optional))
        assertEq(assertOk(toString(optional, skipped)), text)
        assertEq(assertOk(toString(['[]', [optional]], skipped)), text)
        assertEq(Number.isNaN(assertOk(toNumber(optional, skipped))), true)
        const shared = /** @type {const} */ (['[]', []])
        /** @type {ValueFunction} */
        const lazy = ['=>', 0, [], ['[]', [['&&', true, shared], ['||', false, shared]]]]
        assertEq(assertOk(toString(lazy, skipped)), assertOk(tryFunctionText(lazy)))
    },
}
