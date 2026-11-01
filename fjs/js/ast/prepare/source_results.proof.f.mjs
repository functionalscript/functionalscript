/**
 * Source loop packing preserves independent input/result signatures. Execute
 * the prepared text through the unchanged source front end and interpreter.
 *
 * @import { BindingId, Block, Function as FastFunction } from '../types.ts'
 */

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _defaultExport, unresolved } from '../../../compiler/edag/module.f.mjs'
import { parse } from '../../../compiler/source/module.f.mjs'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { stringify } from '../serializer/module.f.mjs'
import { prepare } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** Each fixture creates its own binding/target identities. @type {(single: boolean) => Block} */
const source = single => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const left = id(0), right = id(1), first = id(2), second = id(3)
    /** @type {FastFunction} */
    const fn = {
        target: owner, parameters: [], rest: null, self: null, captures: [],
        body: {
            statements: [['loop', {
                target, parameters: [left, right], initial: [1, 2], results: single ? [first] : [first, second],
                body: {
                    statements: [
                        ['if', [], ['>=', ['ref', left], 3],
                            { statements: [], exit: ['break', target, single ? [['ref', right]] : [['ref', right], ['ref', left]]] },
                            { statements: [], exit: ['yield', []] }],
                        // A normally completing decision precedes the common
                        // transition; this is not a terminal decision tree.
                        ['if', [], ['===', ['ref', right], 0],
                            { statements: [], exit: ['yield', []] },
                            { statements: [], exit: ['yield', []] }],
                    ],
                    exit: ['continue', target, [['ref', right], ['+', ['ref', left], ['ref', right]]]],
                },
            }]],
            exit: ['return', owner, single ? ['ref', first] : ['array', [['ref', first], ['ref', second]]]],
        },
    }
    return { statements: [], exit: ['yield', [['function', fn]]] }
}

/** @type {(single: boolean) => unknown} */
const result = single => {
    const text = stringify(prepare(source(single), { sourceLoops: true }))
    const graph = _defaultExport(unresolved(assertOk(parse('/prepared-results.f.js')(text))).edag)
    const value = memo(assertOk(identityAnalysis(['()', graph, []])))({ args: [] })
    return assertOk(toData(assertOk(value)))
}

export const proof = /** @type {const} */ ({
    structuredOneResultLoopUsesItsNormalContinuation: () => {
        assertEq(result(true), 5)
    },
    multipleLoopResultsKeepTheirIndependentSignature: () => {
        assertStructurallySame(result(false), [5, 3])
    },
    zeroInputNonreturningLoopKeepsItsStatelessSpelling: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const output = id(0)
        /** @type {Block} */
        const root = { statements: [], exit: ['yield', [['function', {
            target: owner, parameters: [], rest: null, self: null, captures: [],
            body: {
                statements: [['loop', { target, parameters: [], initial: [], results: [output],
                    body: { statements: [], exit: ['continue', target, []] } }]],
                exit: ['return', owner, ['ref', output]],
            },
        }]]] }
        assertEq(stringify(prepare(root, { sourceLoops: true })),
            'export default ()=>{while(true){continue;}return undefined;};')
    },
})
