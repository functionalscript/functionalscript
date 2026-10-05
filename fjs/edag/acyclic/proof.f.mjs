/**
 * Acyclic array graphs retain their exact values and sharing. Structural
 * tuples and lists are checked along with EDAG operation nodes.
 *
 * @import { EdagValue } from '../value/types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ValidationError } from '../../rtti/common/types.ts'
 */

import { assertEq, assertOk } from '../../asserts/module.f.mjs'
import { validateAcyclic } from './module.f.mjs'

/** @type {(value: unknown) => void} */
const accept = value => { assertEq(Object.is(assertOk(validateAcyclic(value)), value), true) }

export const proof = {
    constParameter: () => {
        const array = validateAcyclic([1])
        /** @typedef {Assert<Equal<typeof array, Result<readonly [1], ValidationError>>>} _Array */
        assertEq(assertOk(array)[0], 1)
        const func = validateAcyclic(['=>', 0, [], ['undefined']])
        /** @typedef {Assert<Equal<typeof func, Result<readonly ['=>', 0, readonly [], readonly ['undefined']], ValidationError>>>} _Function */
        assertEq(assertOk(func)[0], '=>')
    },
    leaves: () => {
        const values = [undefined, null, false, true, 0, -0, NaN, Infinity, '', 1n, { x: [1] }, () => 1]
        for (const value of values) { accept(value) }
    },
    structuralArrays: () => {
        accept([])
        accept([0, 'value', []])
        accept([[':', 'key', ['undefined']], ['...', ['[]', [1, 2]]]])
    },
    capturesAndBodies: () => {
        /** @type {EdagValue} */
        const value = ['=>', 1, [
            ['{}', [[':', 'x', ['[]', [1]]]]],
            ['=>', 0, [2], ['frame', 0]],
        ], ['=>', 0, [['arg', 0], ['frame', 1]], ['[]', [['frame', 0], ['frame', 1], ['rest']]]]]
        accept(value)
    },
    sharedIdentity: () => {
        const shared = /** @type {const} */ (['[]', [1]])
        const captures = [shared, shared]
        const body = /** @type {const} */ (['[]', [['frame', 0], ['frame', 1]]])
        const func = ['=>', 0, captures, body]
        const value = [shared, func, func, captures, body]
        assertEq(assertOk(validateAcyclic(value)), value)
        assertEq(value[0], shared)
        assertEq(value[1], func)
        assertEq(func[2], captures)
        assertEq(captures[0], captures[1])
    },
    diamond: () => {
        // Thirty sharing levels have only thirty-one distinct arrays.
        /** @type {readonly unknown[]} */
        let value = [0]
        for (let i = 0; i < 30; i += 1) { value = [value, value] }
        accept(value)
    },
    freshCalls: () => {
        const child = [1]
        const left = [child, child]
        const right = [[child], child]
        accept(left)
        accept(right)
        accept(child)
        accept(left)
    },
}
