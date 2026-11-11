import { assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { map } from './module.f.js'

/** @type {(value: unknown, index: number, array: readonly unknown[]) => readonly unknown[]} */
const args = (value, index, array) => [value, index, array]

export const proof = /** @type {const} */ ({
    host: () => {
        for (const input of [[], [1], [1, undefined, null, 4]]) {
            assertStructurallySame(map(input, args), input.map(args))
        }
    },
    identity: () => {
        const first = /** @type {const} */ ({})
        const second = /** @type {const} */ ({})
        const input = /** @type {const} */ ([first, second])
        /** @type {(value: unknown, index: number, receiver: readonly unknown[]) => unknown} */
        const callback = (value, index, receiver) => {
            assertEq(receiver, input)
            assertEq(value, input[index])
            return value
        }
        const output = map(input, callback)
        assertEq(output === input, false)
        assertEq(output[0], first)
        assertEq(output[1], second)
        assertEq(map(input, () => input)[0], input)
        assertEq(map([], () => undefined) === map([], () => undefined), false)
    },
    undefinedAnswers: () => assertStructurallySame(map([1, 2], () => undefined), [undefined, undefined]),
    throw: {
        invalidEmpty: () => map([], undefined),
        invalidNonempty: () => map([1], {}),
        callback: () => map([1, 2], () => { throw 'callback' }),
    },
})
