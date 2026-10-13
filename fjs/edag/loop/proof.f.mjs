/**
 * The template, part by part: what is a loop, and each way a function
 * fails to be one.
 *
 * @import { Exp, Function as FunctionExp } from '../types.ts'
 * @import { Loop } from './types.ts'
 */

import { assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { analysis } from '../analysis/module.f.mjs'
import { loopOf } from './module.f.mjs'

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
}
