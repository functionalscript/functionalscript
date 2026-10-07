/**
 * The shared dispatcher threads an interpreter's immutable state through only
 * demanded operands. Operands here use Amnesia, while the state records each
 * demand so evaluation order and failure propagation remain observable.
 *
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { EdagValue } from '../value/types.ts'
 * @import { Context, Evaluator } from './types.ts'
 */

import { assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { operation } from './module.f.mjs'
import { invoke, vm } from '../amnesia/module.f.mjs'

/** @type {Context} */
const context = { frame: ['F'], args: [10, 20], fixed: [4], rest: ['[]', [5]] }
/** @type {Evaluator<Exp, readonly Exp[]>} */
const evaluator = {
    context,
    operand: (e, state) => [[...state, e], vm(context)(e)],
    expression: e => e,
    invoke,
}
const run = operation(evaluator)

/** @type {(e: ExpOp, expected: EdagValue) => void} */
const eq = (e, expected) => { assertStructurallySame(run(e, [])[1], ['ok', expected]) }
/** @type {(e: ExpOp, expected?: EdagValue) => void} */
const failure = (e, expected = ['undefined']) => { assertStructurallySame(run(e, [])[1], ['error', expected]) }
/** @type {import('../types.ts').Function} */
const identity = ['=>', 1, [], ['arg', 0]]
/** @type {import('../types.ts').Object} */
const throws = ['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'conversion']]]]]

export const proof = {
    // `self` is the function being invoked, the same value every read, so
    // a body calls itself through it and compares it to itself as one;
    // outside a function there is none, and the evaluator throws
    self: () => {
        /** @type {Exp} */
        const fact = ['=>', 1, [], ['?:', ['<', ['arg', 0], 2], 1, ['*', ['arg', 0], ['()', ['self'], [['-', ['arg', 0], 1]]]]]]
        eq(['()', fact, [5]], 120)
        eq(['()', ['=>', 0, [], ['is', ['self'], ['self']]], []], true)
        // a nested function reaches its parent's `self` through a slot
        eq(['()', ['=>', 1, [], ['?:', ['arg', 0], ['()', ['=>', 0, [['self']], ['()', ['frame', 0], [0]]], []], 'base']], [1]], 'base')
        failure(['self'])
    },
    operators: () => {
        eq(['!', 0], true)
        eq(['~', 0], -1)
        eq(['Number', '42'], 42)
        eq(['String', 42], '42')
        eq(['typeof', 1n], 'bigint')
        eq(['+', '5'], 5)
        eq(['-', 5], -5)
        eq(['+', 2, 3], 5)
        eq(['-', 2, 3], -1)
        eq(['*', 2, 3], 6)
        eq(['/', 6, 3], 2)
        eq(['%', 7, 3], 1)
        eq(['**', 2, 3], 8)
        eq(['===', 2, 2], true)
        eq(['is', NaN, NaN], true)
        eq(['is', 0, -0], false)
        eq(['!==', 2, 3], true)
        eq(['<', 2, 3], true)
        eq(['<=', 3, 3], true)
        eq(['>', 2, 3], false)
        eq(['>=', 3, 3], true)
        eq(['&', 6, 3], 2)
        eq(['|', 6, 3], 7)
        eq(['^', 6, 3], 5)
        eq(['<<', 1, 3], 8)
        eq(['>>', -8, 1], -4)
        eq(['>>>', -1, 31], 1)
        eq(['&&', 0, 1], 0)
        eq(['&&', 2, 1], 1)
        eq(['||', 0, 1], 1)
        eq(['||', 2, 1], 2)
        eq(['??', null, 1], 1)
        eq(['??', 0, 1], 0)
        eq(['?:', true, 1, 2], 1)
        eq(['?:', false, 1, 2], 2)
        eq([',', [1, 2]], 2)
        eq([',', []], ['undefined'])
    },
    context: () => {
        eq(['undefined'], ['undefined'])
        eq(['frame', 0], 'F')
        eq(['args'], ['[]', [10, 20]])
        eq(['arg', 0], 4)
        eq(['rest'], ['[]', [5]])
    },
    containers: () => {
        eq(['[]', [1, ['...', ['[]', [2, 3]]]]], ['[]', [1, 2, 3]])
        eq(['{}', [[':', 'a', 1], ['...', ['{}', [[':', 'b', 2]]]]]], ['{}', [[':', 'a', 1], [':', 'b', 2]]])
        eq(['{}', [[':', 1, 2]]], ['{}', [[':', '1', 2]]])
        failure(['[]', [['...', null]]])
        failure(['{}', [['...', ['throw', 'spread']]]], 'spread')
        failure(['{}', [[':', ['{}', [[':', 'toString', ['=>', 0, [], ['throw', 'key']]]]], 1]]], 'key')
        failure(['{}', [[':', 'key', ['throw', 'value']]]], 'value')
    },
    reads: () => {
        const object = /** @type {const} */ (['{}', [[':', 'a', 7]]])
        eq(['.', object, 'a'], 7)
        eq(['own', object, 'a'], 7)
        eq(['?.', null, 'a'], ['undefined'])
        eq(['?.', object, 'a'], 7)
        eq(['?.', ['{}', [[':', 'a', object]]], 'a', ['|.', 'a']], 7)
        failure(['own', object, 1])
        failure(['own', null, 'a'])
        failure(['.', null, 'a', ['|()', []]])
    },
    calls: () => {
        const at = /** @type {const} */ (['[]', [42]])
        eq(['()', identity, [1]], 1)
        eq(['.', at, 'at', ['|()', [0]]], 42)
        eq(['.', at, 'at', ['|?.()', [0], ['|.', 'toFixed', ['|()', [1]]]]], '42.0')
        eq(['?.', at, 'at', ['|()', [0]]], 42)
        eq(['?.', at, 'at', ['|?.()', [0]]], 42)
        eq(['?.', null, 'at', ['|.', 'x']], ['undefined'])
        eq(['?.', ['{}', [[':', 'f', null]]], 'f', ['|?.()', [0], ['|.', 'x']]], ['undefined'])
        eq(['?.()', null, [0]], ['undefined'])
        eq(['?.()', identity, [3]], 3)
        eq(['?.()', ['=>', 1, [], ['{}', [[':', 'y', ['arg', 0]]]]], [3], ['|.', 'y']], 3)
        eq(['?.()', ['=>', 0, [], identity], [], ['|()', [7]]], 7)
        eq(['?.', ['{}', [[':', 'f', identity]]], 'f', ['|?.()', [8]]], 8)
        eq(['.', ['{}', [[':', 'toString', ['=>', 0, [], 'own']]]], 'toString', ['|()', []]], 'own')
        failure(['?.', null, 'a', ['|!()', []]])
        failure(['?.', ['{}', []], 'a', ['|!()', []]])
        failure(['()', 1, [2]])
        failure(['?.()', identity, [['throw', 9]]], 9)
    },
    lambda: () => {
        const f = assertOk(run(['=>', 0, ['captured'], ['frame', 0]], [])[1])
        assertStructurallySame(f, ['=>', 0, ['captured'], ['frame', 0]])
        eq(['()', ['=>', 0, ['captured'], ['frame', 0]], []], 'captured')
        eq(['()', ['=>', 0, [], ['rest']], [1, 2]], ['[]', [1, 2]])
        // Sharing policy survives a call and a builtin callback invocation.
        const child = /** @type {const} */ (['[]', []])
        const body = /** @type {const} */ (['===', child, child])
        eq(['()', ['=>', 0, [], body], []], false)
        eq(['.', ['[]', [1]], 'map', ['|()', [['=>', 0, [], body]]]], ['[]', [false]])
    },
    failures: () => {
        failure(['throw', 1], 1)
        failure(['throw', ['throw', 2]], 2)
        failure(['+', 0n])
        failure(['+', throws, 1], 'conversion')
        failure(['+', 1, throws], 'conversion')
        failure(['!', ['throw', 1]], 1)
        failure([',', [1, ['throw', 2], 3]], 2)
    },
    evaluationOrder: () => {
        const [state, result] = run(['+', 1, 2], ['already'])
        assertStructurallySame(state, ['already', 1, 2])
        assertStructurallySame(result, ['ok', 3])
        assertStructurallySame(run(['&&', 0, ['throw', 1]], [])[0], [0])
        assertStructurallySame(run(['?:', true, 1, ['throw', 2]], [])[0], [true, 1])
        const stop = /** @type {const} */ (['throw', 1])
        assertEq(run(['+', stop, 2], [])[0].length, 1)
        assertStructurallySame(run(['+', throws, 2], [])[0], [throws, 2])
        assertStructurallySame(run(['[]', [1, stop, 3]], [])[0], [1, stop])
        assertStructurallySame(run(['{}', [[':', 'a', 1], [':', 'b', stop]]], [])[0], ['a', 1, 'b', stop])
        assertStructurallySame(run(['?.', null, 'a', ['|!()', [2]]], [])[0], [null, 2])
    },
}
