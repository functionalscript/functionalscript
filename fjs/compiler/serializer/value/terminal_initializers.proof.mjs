/**
 * Terminal-loop entry work runs once before a lifted owning return.
 * Loading compiled JavaScript and counting native callbacks require a host proof.
 * @import { BindingId, Function as FastFunction, Value } from '../../../js/ast/types.ts'
 */

import { Buffer } from 'node:buffer'

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { stringify } from './module.f.mjs'

/** @type {(length: number) => Promise<any>} */
const load = async length => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    /** @type {readonly BindingId[]} */
    const parameters = Array.from({ length }, (_, index) => ({ index }))
    /** @type {readonly Value[]} */
    const initial = parameters.map(parameter => ['()', ['ref', parameter], []])
    /** @type {FastFunction} */
    const fn = { target: owner, parameters, rest: null, self: null, captures: [], body: {
        statements: [], exit: ['loop', { target, parameters: parameters.map(parameter => ({ index: parameter.index + length })),
            initial, results: [], body: { statements: [], exit: ['return', owner,
                ['block', { statements: [], exit: ['return', owner, 7] }],
            ] } }],
    } }
    const graph = fromFast({ statements: [], exit: ['yield', [['function', fn]]] })
    const value = assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
    const text = stringify(value)
    return (await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)).default
}

export const proof = /** @type {const} */ ({
    terminalLoopInitializerRunsOnceBeforeLiftedReturn: async () => {
        const apply = await load(1)
        let calls = 0
        assertEq(apply(() => { calls += 1; return 3 }), 7)
        assertEq(calls, 1)
    },
    terminalLoopInitializersKeepTheirEntryOrder: async () => {
        const apply = await load(2)
        /** @type {string[]} */
        const calls = []
        assertEq(apply(
            () => { calls.push('first'); return 3 },
            () => { calls.push('second'); return 5 },
        ), 7)
        assertStructurallySame(calls, ['first', 'second'])
    },
})
