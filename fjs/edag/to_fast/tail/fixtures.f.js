/** Shared identity-sensitive DAG fixtures for terminal and mixed self uses.
 * @import { Exp, Function as FunctionExp } from '../../types.ts'
 */

/** Each terminal call is reused in both arms of the outer decision.
 * @type {(arity: number, n: Exp, flag: Exp, left: Exp, right: Exp, base: Exp, reversed?: boolean) => Exp}
 */
const interleaved = (arity, n, flag, left, right, base, reversed = false) => ['=>', arity, [], ['?:', ['>', n, 0],
    ['?:', flag, ['?:', ['%', n, 2], left, right], ['?:', ['%', n, 3], reversed ? right : left, reversed ? left : right]], base,
]]

/** @type {() => Exp} */
const scalar = () => {
    const n = /** @type {const} */ (['arg', 0])
    const flag = /** @type {const} */ (['arg', 1])
    const left = /** @type {const} */ (['()', ['self'], [['-', n, 1], false]])
    const right = /** @type {const} */ (['()', ['self'], [['-', n, 1], true]])
    return interleaved(2, n, flag, left, right, 0)
}

/** Left swaps the old pair; right preserves it. @type {() => Exp} */
const vectors = () => {
    const n = /** @type {const} */ (['arg', 0])
    const flag = /** @type {const} */ (['arg', 1])
    const a = /** @type {const} */ (['arg', 2])
    const b = /** @type {const} */ (['arg', 3])
    const left = /** @type {const} */ (['()', ['self'], [['-', n, 1], false, b, a]])
    const right = /** @type {const} */ (['()', ['self'], [['-', n, 1], true, a, b]])
    return interleaved(4, n, flag, left, right, ['[]', [a, b]])
}

/** A selected ignored argument remains required; the other recipe is clean.
 * @type {() => Exp}
 */
const selectedFailure = () => {
    const n = /** @type {const} */ (['arg', 0])
    const flag = /** @type {const} */ (['arg', 1])
    const failed = /** @type {const} */ (['arg', 2])
    const left = /** @type {const} */ (['()', ['self'], [['-', n, 1], false, failed, ['?:', failed, ['throw', 7], ['undefined']]]])
    const right = /** @type {const} */ (['()', ['self'], [['-', n, 1], true, failed]])
    return interleaved(3, n, flag, left, right, 0, true)
}

/** The next invocation keeps this invocation's reader and allocation.
 * @type {() => Exp}
 */
const snapshots = () => {
    const n = /** @type {const} */ (['arg', 0])
    const flag = /** @type {const} */ (['arg', 1])
    const previous = /** @type {const} */ (['arg', 2])
    const current = /** @type {const} */ (['[]', [n]])
    const reader = /** @type {const} */ (['=>', 0, [current], ['frame', 0]])
    const left = /** @type {const} */ (['()', ['self'], [['-', n, 1], false, reader]])
    const right = /** @type {const} */ (['()', ['self'], [['-', n, 1], true, reader]])
    return interleaved(3, n, flag, left, right, ['[]', [current, current, reader, ['()', previous, []]]])
}

/** Fresh graphs retain genuinely shared terminal-call and prerequisite nodes. */
export const _independentTailRecipes = () => /** @type {const} */ ({
    scalar: scalar(), vectors: vectors(), selectedFailure: selectedFailure(), snapshots: snapshots(),
})

/** Tail transitions end in one shared ordinary self call and following work.
 * @type {() => FunctionExp}
 */
export const _mixedSelfUses = () => {
    const ordinary = /** @type {const} */ (['()', ['self'], [0]])
    return ['=>', 1, [7, ['[]', []], 9], ['?:', ['>', ['arg', 0], 1],
        ['()', ['self'], [['-', ['arg', 0], 1]]],
        ['?:', ['===', ['arg', 0], 1], ['[]', [ordinary, ordinary]],
            ['[]', [['frame', 2], ['frame', 0], ['frame', 1], ['self']]]],
    ]]
}
