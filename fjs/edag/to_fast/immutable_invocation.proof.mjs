/**
 * Native graph recovery removes an invocation boundary that cannot repeat.
 * Host execution observes owning returns, required calls and allocation identity.
 * This code-only boundary accepts normalized FAST independently of source syntax;
 * the public source writer retains its separate parser-readback contract.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { JsToken } from '../../ebnf/lib/js/types.ts'
 */

import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { _controlFlowFunctions } from '../from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../from_fast/module.f.mjs'
import { _counting } from '../from_fast/proof.f.mjs'
import { fromAnalysis } from './module.f.mjs'
import { _tailFunction } from './tail_calls/proof.f.mjs'
import { prepare, prepareFunction } from '../../js/ast/prepare/module.f.mjs'
import { functionStringify, stringify } from '../../js/ast/serializer/module.f.mjs'
import { tokenize } from '../../js/tokenizer/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { parse } from '../../compiler/source/module.f.mjs'
import { tryStringify } from '../../compiler/serializer/module.f.mjs'

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(value: unknown) => unknown} */
const identity = value => value
/** @type {() => never} */
const failed = () => { throw 'selected required work' }
/** @type {(fn: FastFunction) => Exp} */
const graphOf = fn => fromFast(block(['yield', [['function', fn]]]))

/** These fixtures contain statement decisions, without nested value owners.
 * @type {(source: Block, target: LoopTarget) => Block}
 */
const returnsAsBreaks = (source, target) => ({
    statements: source.statements.map(/** @returns {Statement} */ statement => statement[0] === 'if'
        ? ['if', statement[1], statement[2], returnsAsBreaks(statement[3], target), returnsAsBreaks(statement[4], target)] : statement),
    exit: source.exit[0] === 'return' ? ['break', target, [source.exit[2]]] : source.exit,
})

/** @type {(fn: FastFunction) => { readonly text: string; readonly apply: (...args: readonly unknown[]) => any }} */
const compiled = fn => {
    const text = stringify(prepare(fromAnalysis(assertOk(identityAnalysis(graphOf(fn))))), 'expression', true)
    return { text, apply: Function(`"use strict";return (${text});`)() }
}

/** @type {(text: string) => readonly JsToken['kind'][]} */
const tokenKinds = text => {
    const tokens = toArray(tokenize(stringToCodePointList(text))(''))
    assert(tokens.every(({ token }) => token.kind !== 'error'), text)
    return tokens.map(({ token }) => token.kind)
}

/** Only the admitted non-loop joins have this output-shape contract.
 * @type {(text: string) => void}
 */
const immutable = text => {
    const kinds = tokenKinds(text)
    assert(!kinds.includes('while'), text)
    assert(!kinds.includes('let'), text)
}

const paths = /** @type {const} */ ([[false, false], [false, true], [true, false], [true, true]])

export const proof = /** @type {const} */ ({
    graphJoinsRecoverTheirOwningReturnBeforeImmutablePreparation: async () => {
        for (const fn of [_controlFlowFunctions.parameterizedJoin, _controlFlowFunctions.parameterizedHelper]) {
            const { text, apply } = compiled(fn)
            immutable(text)
            assertEq(apply.length, 3)
            for (const [selected, stop] of paths) {
                let calls = 0
                const result = apply(selected, stop, /** @param {number} value */ value => { calls += 1; return value })
                assertEq(result, selected && stop ? 42 : selected ? 8 : 5)
                assertEq(calls, selected && stop ? 0 : 1)
            }
            assertEq(apply(true, true, failed), 42)

            // Source output keeps its existing admission and may retain loop state.
            const source = assertOk(tryStringify(graphOf(fn)))
            assertOk(parse('/graph-join-source.f.mjs')(source))
            const publicApply = (await import(`data:text/javascript,${encodeURIComponent(source)}`)).default
            for (const [selected, stop] of paths) {
                assertEq(publicApply(selected, stop, identity), selected && stop ? 42 : selected ? 8 : 5)
            }
            assertEq(publicApply(true, true, failed), 42)
        }
    },
    nestedOwningReturnsBypassTheSharedNormalContinuation: () => {
        const { text, apply } = compiled(_controlFlowFunctions.nested)
        immutable(text)
        assertEq(apply.length, 4)
        for (const [selected, stop] of paths) {
            const incoming = /** @type {const} */ ([4])
            const normal = /** @type {const} */ ([8])
            const early = /** @type {const} */ ([42])
            let factories = 0
            let continuations = 0
            const result = apply(selected, incoming,
                () => { factories += 1; return { a: normal, b: stop, c: early } },
                /** @param {unknown} value */ value => { continuations += 1; return value },
            )
            assertEq(result, selected && stop ? early : selected ? normal : incoming)
            assertEq(factories, selected ? 1 : 0)
            assertEq(continuations, selected && stop ? 0 : 1)
        }
        assertEq(apply(false, 9, failed, identity), 9)
        assertEq(apply(true, 9, () => ({ a: 3, b: true, c: 7 }), failed), 7)
        throws(() => apply(true, 9, failed, identity))
        throws(() => apply(true, 9, () => ({ a: 3, b: false, c: 7 }), failed))
    },
    requiredPrefixAndSelectedSuffixKeepTheirExecutionRegions: () => {
        const source = _controlFlowFunctions.parameterizedJoin
        const initializer = /** @type {const} */ ({ index: 10 })
        const established = /** @type {const} */ ({ index: 11 })
        const join = source.body.statements[0]
        assert(join[0] === 'if' && join[1].length === 1)
        /** @type {FastFunction} */
        const fn = { ...source, parameters: [...source.parameters, initializer], body: block(['return', source.target,
            ['()', ref(source.parameters[2]), [['array', [ref(established), ref(join[1][0]), ref(established)]]]],
        ], [['define', established, ['()', ref(initializer), []], 'required'], ...source.body.statements]) }
        // This graph reconstructs a zero-result guard and a conditional value.
        // Its existing wrapper plan remains a semantic control for required work.
        const { apply } = compiled(fn)
        assertEq(apply.length, 4)
        for (const [selected, stop] of paths) {
            const marker = /** @type {const} */ ([11])
            /** @type {string[]} */
            const calls = []
            const value = apply(selected, stop,
                /** @param {unknown} result */ result => { calls.push('suffix'); return result },
                () => { calls.push('prefix'); return marker },
            )
            if (selected && stop) { assertEq(value, 42); assertStructurallySame(calls, ['prefix']) }
            else {
                assertEq(value[0], marker)
                assertEq(value[2], marker)
                assertEq(value[1], selected ? 3 : 0)
                assertStructurallySame(calls, ['prefix', 'suffix'])
            }
        }
        throws(() => apply(true, true, identity, failed))
        throws(() => apply(false, false, failed, identity))
        throws(() => apply(true, false, failed, identity))
        assertEq(apply(true, true, failed, identity), 42)
    },
    sharedSuffixAllocationsStaySharedAndFreshPerInvocation: () => {
        const source = _controlFlowFunctions.parameterizedJoin
        const allocation = /** @type {const} */ ({ index: 10 })
        const join = source.body.statements[0]
        assert(join[0] === 'if' && join[1].length === 1)
        /** @type {FastFunction} */
        const fn = { ...source, body: block(['return', source.target, ['array', [ref(allocation), ref(allocation)]]], [
            ...source.body.statements, ['define', allocation, ['array', [ref(join[1][0])]], 'required'],
        ]) }
        // The shared allocation reconstructs a memo cell, outside this recovery.
        const { apply } = compiled(fn)
        const first = apply(false, false, identity)
        const second = apply(true, false, identity)
        assertEq(first[0], first[1])
        assertEq(second[0], second[1])
        assert(first[0] !== second[0])
        assertStructurallySame(first, [[0], [0]])
        assertStructurallySame(second, [[3], [3]])
        assertEq(apply(true, true, failed), 42)

        const normal = compiled(source)
        immutable(normal.text)
        let calls = 0
        /** @param {number} value */
        const allocate = value => {
            calls += 1
            const item = /** @type {const} */ ([value])
            return /** @type {const} */ ([item, item, () => item])
        }
        const left = normal.apply(false, false, allocate)
        const right = normal.apply(true, false, allocate)
        assertEq(left[0], left[1])
        assertEq(right[0], right[1])
        assertEq(left[2](), left[0])
        assertEq(right[2](), right[0])
        assert(left[0] !== right[0])
        assertStructurallySame(left.slice(0, 2), [[5], [5]])
        assertStructurallySame(right.slice(0, 2), [[8], [8]])
        assertEq(calls, 2)
    },
    loopInputShadowsRetainTheirOriginalInvocationBoundary: () => {
        const source = _controlFlowFunctions.parameterizedJoin
        const target = /** @type {const} */ ({ kind: 'loop', index: 90 })
        const result = /** @type {const} */ ({ index: 90 })
        /** @type {Loop} */
        const loop = { target, parameters: source.parameters, initial: source.parameters.map(ref), results: [result],
            body: returnsAsBreaks(source.body, target) }
        /** @type {FastFunction} */
        const fn = { ...source, body: block(['return', source.target, ref(result)], [['loop', loop]]) }
        /** @type {readonly BindingId[]} */
        const entry = source.parameters.map(binding => ({ index: binding.index }))
        /** @type {FastFunction} */
        const prefixShadow = { ...source, parameters: entry, body: block(['return', source.target, ref(result)], [
            ['loop', { ...loop, initial: entry.map(ref), body: { ...loop.body,
                statements: [['define', entry[0], 1, 'required'], ...loop.body.statements],
            } }],
        ]) }
        const local = /** @type {const} */ ({ index: 90 })
        const join = source.body.statements[0]
        assert(join[0] === 'if')
        /** @type {Block} */
        const otherwise = block(['yield', [ref(local)]], [['define', local, 0, 'required']])
        /** @type {Block} */
        const shadowedBody = block(source.body.exit, [
            ['define', local, 7, 'required'], ['if', join[1], join[2], join[3], otherwise],
        ])
        /** @type {FastFunction} */
        const falseArmShadow = { ...source, parameters: entry, body: block(['return', source.target, ref(result)], [
            ['loop', { ...loop, initial: entry.map(ref), body: returnsAsBreaks(shadowedBody, target) }],
        ]) }
        for (const original of [fn, prefixShadow, falseArmShadow]) {
            // Direct preparation preserves valid lexical identity reuse. Graph
            // conversion would introduce fresh bindings and hide the overlap.
            const prepared = prepareFunction(original)
            const text = functionStringify(prepared)
            const apply = Function(`"use strict";return (${text});`)()
            assert(tokenKinds(text).includes('while'), text)
            assertEq(prepared.target, original.target)
            assertEq(prepared.parameters, original.parameters)
            assertEq(prepared.self, null)
            assertEq(apply.length, 3)
            for (const [selected, stop] of paths) {
                let calls = 0
                const actual = apply(selected, stop, /** @param {number} value */ value => {
                    calls += 1
                    const item = /** @type {const} */ ([value])
                    return /** @type {const} */ ([item, item])
                })
                if (selected && stop) { assertEq(actual, 42); assertEq(calls, 0) }
                else {
                    assertEq(actual[0], actual[1])
                    assertStructurallySame(actual, [[selected ? 8 : 5], [selected ? 8 : 5]])
                    assertEq(calls, 1)
                }
            }
            assertEq(apply(true, true, failed), 42)
            const first = apply(false, false, /** @param {number} value */ value => [value])
            const second = apply(false, false, /** @param {number} value */ value => [value])
            assert(first !== second)
        }

        // The ordinary join also owns an else scope. Flattening its definition
        // into the function would redeclare the selected parameter.
        /** @type {Block} */
        const selectedShadow = block(['yield', [ref(source.parameters[0])]], [
            ['define', source.parameters[0], 9, 'required'],
        ])
        /** @type {FastFunction} */
        const direct = { ...source, body: { ...source.body, statements: [
            ['if', join[1], join[2], join[3], selectedShadow],
        ] } }
        const prepared = prepareFunction(direct)
        const text = functionStringify(prepared)
        const apply = Function(`"use strict";return (${text});`)()
        assertEq(prepared.parameters, direct.parameters)
        assertEq(prepared.target, direct.target)
        assertEq(apply.length, 3)
        for (const [selected, stop] of paths) {
            let calls = 0
            const actual = apply(selected, stop, /** @param {number} value */ value => { calls += 1; return value })
            assertEq(actual, selected && stop ? 42 : selected ? 8 : 14)
            assertEq(calls, selected && stop ? 0 : 1)
        }
        assertEq(apply(true, true, failed), 42)
    },
    genuineLoopsAndOwningSelfTailCallsStillUseWhile: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 20 })
        const limit = /** @type {const} */ ({ index: 20 })
        const loop = _counting(0, ref(limit))
        /** @type {FastFunction} */
        const fn = { target, parameters: [limit], rest: null, self: null, captures: [],
            body: block(['return', target, ref(loop.results[0])], [['loop', loop]]) }
        const counting = compiled(fn)
        assert(tokenKinds(counting.text).includes('while'), counting.text)
        assertEq(counting.apply(0), 0)
        assertEq(counting.apply(100_001), 100_001)

        const countdown = _tailFunction(['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1]]], 0,
        ]])
        const recursive = compiled(countdown)
        assert(tokenKinds(recursive.text).includes('while'), recursive.text)
        assertEq(recursive.apply(0), 0)
        assertEq(recursive.apply(100_001), 0)
    },
})
