/**
 * The template, part by part: what is a loop, and each way a function
 * fails to be one.
 *
 * @import { Exp, Function as FunctionExp } from '../types.ts'
 * @import { Loop } from './types.ts'
 */

import { assertEq, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { analysis, identityAnalysis } from '../analysis/module.f.mjs'
import { keepsRecursion, loopOf, reaches } from './module.f.mjs'

/** The parts of a function at the root of its own table, or `null`. @type {(e: FunctionExp) => Loop | null} */
const parts = e => {
    const a = assertOk(analysis(e))
    return loopOf(a, /** @type {readonly ['#', number]} */ (a.root)[1])
}

/** `self(NEXT)`. @type {(next: Exp) => Exp} */
const call = next => ['()', ['self'], [next]]

/** `r => COND ? STEP : r`. @type {(condition: Exp, step: Exp) => FunctionExp} */
const loop = (condition, step) => ['=>', 1, [], ['?:', condition, step, ['arg', 0]]]

/** `r => r < 10 ? self(r + 1) : r`, the loop. @type {FunctionExp} */
const counting = loop(['<', ['arg', 0], 10], call(['+', ['arg', 0], 1]))

/** Whether a table's writer keeps the recursion for a function at the table's root, which is a loop. @type {(table: typeof analysis) => (e: FunctionExp) => boolean} */
const keptIn = table => e => {
    const a = assertOk(table(e))
    const i = /** @type {readonly ['#', number]} */ (a.root)[1]
    return keepsRecursion(a, i, assertNotNullish(loopOf(a, i), ['no loop', e]))
}

/**
 * Whether every writer keeps the recursion for a function at the root of
 * its own table, which is a loop — one answer from the table that merges
 * twins and the one that merges nothing.
 *
 * @type {(e: FunctionExp) => boolean}
 */
const kept = e => {
    const merged = keptIn(analysis)(e)
    assertEq(keptIn(identityAnalysis)(e), merged, JSON.stringify(e))
    return merged
}

export const proof = {
    template: () => {
        // the parts name the entries the table gives them: the condition
        // and the next value, each after the argument read they share
        assertStructurallySame(parts(counting), { before: [], condition: ['#', 1], arm: ['#', 4], asserts: [], next: ['#', 3] })
        // a comma around the call is the asserts of the loop's body
        assertStructurallySame(parts(loop(true, [',', [['[]', []], ['[]', [1]], call(0)]])),
            { before: [], condition: true, arm: ['#', 4], asserts: [['#', 0], ['#', 1]], next: 0 })
        // and a comma at the root the asserts before the condition
        assertStructurallySame(parts(['=>', 1, [], [',', [['[]', []], ['?:', true, call(0), ['arg', 0]]]]]),
            { before: [['#', 0]], condition: true, arm: ['#', 2], asserts: [], next: 0 })
        // the frame is any
        assertStructurallySame(parts(['=>', 1, [['[]', []]], ['?:', ['frame', 0], call(['frame', 0]), ['arg', 0]]]),
            { before: [], condition: ['#', 1], arm: ['#', 3], asserts: [], next: ['#', 1] })
        // a nested function's own `self` is its own, and so is its scope
        assertStructurallySame(parts(loop(true, call(['()', ['=>', 0, [], ['()', ['self'], []]], []]))),
            { before: [], condition: true, arm: ['#', 5], asserts: [], next: ['#', 4] })
    },
    refused: () => {
        /** @type {readonly FunctionExp[]} */
        const cases = [
            // another length
            ['=>', 0, [], ['?:', true, ['()', ['self'], [0]], ['rest']]],
            ['=>', 2, [], ['?:', true, call(0), ['arg', 0]]],
            // a body that is no `?:`: a value, a primitive, a comma holding
            // nothing, and a shared `?:`
            ['=>', 1, [], ['arg', 0]],
            ['=>', 1, [], 1],
            ['=>', 1, [], [',', []]],
            ['=>', 1, [], [',', [counting[3], counting[3]]]],
            // a consequent that is no self-call: a value, a call of another
            // callee, a call of two arguments, of a spread, and a shared one
            loop(true, ['arg', 0]),
            loop(true, ['()', ['arg', 0], [1]]),
            loop(true, ['()', 1, [1]]),
            loop(true, ['()', ['self'], [0, 1]]),
            loop(true, ['()', ['self'], [['...', ['[]', []]]]]),
            loop(true, [',', [call(0), call(0)]]),
            // an alternate that is not the parameter
            ['=>', 1, [], ['?:', true, call(0), 1]],
            ['=>', 1, [], ['?:', true, call(0), ['rest']]],
            // `self` read anywhere else: in the condition, as the next
            // value, and captured by a nested function
            loop(['()', ['self'], [1]], call(0)),
            loop(true, call(['self'])),
            loop(true, call(['=>', 0, [['self']], 1])),
        ]
        for (const e of cases) { assertEq(parts(e), null, JSON.stringify(e)) }
    },
    /**
     * Whether an operand reaches an entry among those given, in its own
     * scope: through any operand, a function's slots and not its body,
     * each entry walked once however many paths lead to it.
     */
    reaches: () => {
        /** @type {Exp} */
        const c = ['[]', []]
        // entries in walk order: 0 `c`, 1 `[c, c]`, 2 `[1]` and 3 the body
        // `[[1]]`, 4 the function, 5 the root
        const a = assertOk(analysis(['[]', [['[]', [c, c]], ['=>', 0, [c], ['[]', [['[]', [1]]]]], 2]]))
        assertEq(reaches(a, [0])(['#', 1]), true)
        assertEq(reaches(a, [0])(['#', 4]), true)
        assertEq(reaches(a, [2])(['#', 4]), false)
        assertEq(reaches(a, [0])(2), false)
    },
    /**
     * The shapes every writer keeps the recursion for, though they match:
     * an assert before the condition, a read of the rest array, and a
     * value minting identity that the condition shares with the block.
     */
    kept: () => {
        /** @type {Exp} */
        const a0 = ['arg', 0]
        /** @type {Exp} */
        const minted = ['[]', [a0]]
        /** @type {Exp} */
        const merged = ['.', a0, 0]
        /** @type {Exp} */
        const sharedRead = ['.', minted, 0]
        /** @type {Exp} */
        const inner = ['[]', [1]]
        for (const e of /** @type {readonly FunctionExp[]} */ ([
            ['=>', 1, [], [',', [['[]', []], ['?:', true, call(0), a0]]]],
            loop(['.', ['rest'], 'length'], call(a0)),
            loop(['.', minted, 0], call(['.', minted, 'length'])),
            loop(['()', minted, []], call(['[]', [minted]])),
            // a minted value both reach under two equal reads, or under
            // one read they share, which only the merged table counts as
            // shared itself
            loop(['<', ['.', minted, 0], 9], call(['+', ['.', minted, 0], 1])),
            loop(['<', sharedRead, 9], call(['+', sharedRead, 1])),
        ])) { assertEq(kept(e), true, JSON.stringify(e)) }
        for (const e of /** @type {readonly FunctionExp[]} */ ([
            counting,
            // a read the condition and the block repeat merges, one value
            // however many times it is evaluated
            loop(['<', merged, 10], call(['+', merged, 1])),
            // a minted value shared within the condition alone, or within
            // the block alone, and one of a nested function's own scope
            loop(['.', ['[]', [minted, minted]], 0], call(['+', a0, 1])),
            loop(['<', a0, 10], call(['[]', [minted, minted]])),
            loop(['()', ['=>', 0, [], ['[]', [inner, inner]]], []], call(['+', a0, 1])),
        ])) { assertEq(kept(e), false, JSON.stringify(e)) }
    },
}
