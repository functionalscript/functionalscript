/**
 * Host fixtures for the cycle-refusal contract in ./module.f.mjs.
 * FunctionalScript cannot construct cyclic arrays. Under fjs/AGENTS.md §1.6,
 * host mutation only establishes the cyclic edges needed to prove that
 * boundary's diagnostics. Ordinary inputs remain in proof.f.mjs.
 */

import { assertEq, assertError, assertStructurallySame } from '../../asserts/module.f.mjs'
import { validateAcyclic } from './module.f.mjs'

/** @type {(value: unknown, path: readonly string[]) => void} */
const reject = (value, path) => {
    assertStructurallySame(assertError(validateAcyclic(value)), { path, message: 'cyclic array graph' })
}

export const proof = {
    directCycle: () => {
        /** @type {unknown[]} */
        const value = [0]
        value[0] = value
        reject(value, ['0'])
        assertEq(value.length, 1)
        assertEq(value[0], value)
    },
    indirectCycle: () => {
        /** @type {unknown[]} */
        const left = []
        const right = ['middle', left]
        left[0] = right
        reject(left, ['0', '1'])
        assertEq(left.length, 1)
        assertEq(left[0], right)
        assertEq(right.length, 2)
        assertEq(right[0], 'middle')
        assertEq(right[1], left)
    },
    captureCycle: () => {
        /** @type {unknown[]} */
        const captures = []
        const func = ['=>', 0, captures, 1]
        captures[0] = func
        reject(func, ['2', '0'])
        assertEq(func[2], captures)
        assertEq(captures.length, 1)
        assertEq(captures[0], func)
        assertEq(func[3], 1)
    },
    bodyCycle: () => {
        /** @type {unknown[]} */
        const body = ['+', 1, 0]
        const func = ['=>', 0, [], body]
        body[2] = body
        reject(func, ['3', '2'])
        assertEq(func[3], body)
        assertEq(body.length, 3)
        assertEq(body[1], 1)
        assertEq(body[2], body)
    },
    structuralListCycle: () => {
        /** @type {unknown[]} */
        const items = []
        const value = ['[]', items]
        items[0] = items
        reject(value, ['1', '0'])
        assertEq(value[1], items)
        assertEq(items.length, 1)
        assertEq(items[0], items)
    },
    cycleAfterSharedSibling: () => {
        const shared = [1]
        /** @type {unknown[]} */
        const cyclic = [2]
        cyclic[1] = cyclic
        const value = [shared, shared, cyclic]
        reject(value, ['2', '1'])
        reject(value, ['2', '1'])
        assertEq(value.length, 3)
        assertEq(value[0], shared)
        assertEq(value[1], shared)
        assertEq(value[2], cyclic)
        assertEq(shared.length, 1)
        assertEq(shared[0], 1)
        assertEq(cyclic.length, 2)
        assertEq(cyclic[0], 2)
        assertEq(cyclic[1], cyclic)
    },
}
