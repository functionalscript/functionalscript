/**
 * Source loop packing preserves independent input/result signatures. Execute
 * the prepared text through the unchanged source front end and interpreter.
 *
 * @import { BindingId, Block, Function as FastFunction, Value } from '../types.ts'
 * @import { Exp } from '../../../edag/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _defaultExport, unresolved } from '../../../compiler/edag/module.f.mjs'
import { parse } from '../../../compiler/source/module.f.mjs'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { _controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { stringify } from '../serializer/module.f.mjs'
import { prepare } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** A normal inner arm requires the existing loop source profile.
 * @type {(inverted: boolean) => Block}
 */
const normalInnerDecision = inverted => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const entries = Array.from({ length: 4 }, (_, index) => id(index))
    const parameters = entries.map((_, index) => id(index))
    const [selected, stop, work, operation] = parameters
    const joined = id(4), ignored = id(5), output = id(6)
    /** @type {Block} */
    const alternative = { statements: [], exit: inverted ? ['return', owner, 42] : ['yield', []] }
    /** @type {FastFunction} */
    const fn = { target: owner, parameters: entries, rest: null, self: null, captures: [], body: {
        statements: [['loop', { target, parameters, initial: entries.map(ref), results: [output], body: {
            statements: [['if', [joined], ref(selected), {
                statements: [['if', [], ref(stop), {
                    statements: [['define', ignored, ['()', ref(work), []], 'required']], exit: ['yield', []],
                }, alternative]],
                exit: ['yield', [3]],
            }, { statements: [], exit: ['yield', [0]] }]],
            exit: ['break', target, [['()', ref(operation), [['+', ref(joined), 5]]]]],
        } }]],
        exit: ['return', owner, ref(output)],
    } }
    return { statements: [], exit: ['yield', [['function', fn]]] }
}

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

/** @type {(fn: Exp, args: readonly Exp[]) => unknown} */
const invoked = (fn, args) => assertOk(toData(assertOk(memo(assertOk(identityAnalysis(['()', fn, args])))({ args: [] }))))

/** @type {(single: boolean) => unknown} */
const result = single => {
    const text = stringify(prepare(source(single), { sourceLoops: true }))
    const graph = _defaultExport(unresolved(assertOk(parse('/prepared-results.f.js')(text))).edag)
    return invoked(graph, [])
}

export const proof = /** @type {const} */ ({
    normalAndInvertedInnerDecisionsKeepTheirSourceLoopFallback: () => {
        const identity = /** @type {const} */ (['=>', 1, [], ['arg', 0]])
        const complete = /** @type {const} */ (['=>', 0, [], 7])
        const failed = /** @type {const} */ (['=>', 0, [], ['throw', 'selected work']])
        for (const inverted of [false, true]) {
            const text = stringify(prepare(normalInnerDecision(inverted), { sourceLoops: true }))
            assert(text.includes('while('))
            const parsed = _defaultExport(unresolved(assertOk(parse('/prepared-inner-decision.f.js')(text))).edag)
            assertEq(invoked(parsed, [false, false, failed, identity]), 5)
            assertEq(invoked(parsed, [false, true, failed, identity]), 5)
            assertEq(invoked(parsed, [true, true, complete, identity]), 8)
            assertEq(invoked(parsed, [true, false, failed, inverted ? failed : identity]), inverted ? 42 : 8)
            assertError(memo(assertOk(identityAnalysis(['()', parsed, [true, true, failed, identity]])))({ args: [] }))
        }
    },
    onePassSourceJoinKeepsItsOwningReturnAndNormalContinuation: () => {
        const graph = fromFast({ statements: [], exit: ['yield', [['function', _controlFlowFunctions.parameterizedJoin]]] })
        const prepared = prepare(fromAnalysis(assertOk(identityAnalysis(graph))), { sourceLoops: true })
        const declaration = prepared.statements.find(statement => statement[0] === 'define'
            && statement[2] instanceof Array && statement[2][0] === 'function')
        assert(declaration !== undefined && declaration[0] === 'define')
        const fn = declaration[2]
        assert(fn instanceof Array && fn[0] === 'function')
        assertEq(fn[1].parameters.length, 3)
        assert(!fn[1].body.statements.some(statement => statement[0] === 'slot' || statement[0] === 'loop' || statement[0] === 'while'))
        const text = stringify(prepared)
        const parsed = _defaultExport(unresolved(assertOk(parse('/prepared-source-join.f.js')(text))).edag)
        const identity = /** @type {const} */ (['=>', 1, [], ['arg', 0]])
        for (const [selected, stop, expected] of /** @type {const} */ ([[false, false, 5], [false, true, 5], [true, false, 8]])) {
            assertEq(invoked(parsed, [selected, stop, identity]), expected)
        }
        const failed = /** @type {const} */ (['=>', 1, [], ['throw', 'the owning return must skip the continuation']])
        assertEq(invoked(parsed, [true, true, failed]), 42)
    },
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
