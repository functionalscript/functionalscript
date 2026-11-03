/**
 * Native execution of immutable continuations prepared from normalized FAST.
 * Supplied joins have their own source-independent admission boundary.
 * @import { BindingId, Block, Function as FastFunction, Statement, Value } from '../types.ts'
 * @import { Function as PreparedFunction } from './types.ts'
 * @import { JsToken } from '../../../ebnf/lib/js/types.ts'
 */

import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare, prepareFunction } from './module.f.mjs'
import { functionStringify, stringify } from '../serializer/module.f.mjs'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(value: unknown) => unknown} */
const identity = value => value
/** @type {() => never} */
const failed = () => { throw 'selected required work' }

/** External captures are constructed by the whole-function expression boundary.
 * @type {(fn: FastFunction, closed?: boolean) => { readonly text: string; readonly apply: (...args: readonly unknown[]) => any; readonly prepared: PreparedFunction }}
 */
const compiled = (fn, closed = false) => {
    const prepared = prepareFunction(fn)
    const text = closed ? stringify({ statements: [], exit: ['yield', [['function', prepared]]] }, 'expression', true)
        : functionStringify(prepared)
    return { text, prepared, apply: Function(`"use strict";return (${text});`)() }
}

/** Graph recovery is a distinct boundary; it may still introduce an invocation loop.
 * @type {(fn: FastFunction) => { readonly text: string; readonly apply: (...args: readonly unknown[]) => any }}
 */
const graphCompiled = fn => {
    const graph = fromFast(block(['yield', [['function', fn]]]))
    const text = stringify(prepare(fromAnalysis(assertOk(identityAnalysis(graph)))), 'expression', true)
    return { text, apply: Function(`"use strict";return (${text});`)() }
}

/** @type {(text: string) => readonly JsToken['kind'][]} */
const tokenKinds = text => {
    const tokens = toArray(tokenize(stringToCodePointList(text))(''))
    assert(tokens.every(({ token }) => token.kind !== 'error'), text)
    return tokens.map(({ token }) => token.kind)
}

/** @type {(text: string) => void} */
const immutable = text => {
    const kinds = tokenKinds(text)
    assert(!kinds.includes('let'), text)
    assert(!kinds.includes('while'), text)
}

/** @type {(fn: FastFunction) => BindingId} */
const joined = fn => {
    const statement = fn.body.statements[0]
    assert(statement[0] === 'if' && statement[1].length === 1)
    return statement[1][0]
}

/** Inspect nested function ownership without executing the returned closure.
 * @type {(node: unknown, target: FastFunction['target']) => boolean}
 */
const retainsFunctionOwner = (node, target) => {
    if (node instanceof Array && node[0] === 'function' && node[1].target === target) {
        return node[1].body.exit[0] === 'return' && node[1].body.exit[1] === target
    }
    return node !== null && typeof node === 'object' && Object.values(node).some(value => retainsFunctionOwner(value, target))
}

/** Owning self calls must not migrate into a new ordinary continuation.
 * @type {(node: unknown, self: BindingId) => boolean}
 */
const ownsSelfCall = (node, self) => {
    if (node instanceof Array && node[0] === 'function') { return false }
    if (node instanceof Array && node[0] === '()' && node[1] instanceof Array
        && node[1][0] === 'ref' && node[1][1] === self) { return true }
    return node !== null && typeof node === 'object' && Object.values(node).some(value => ownsSelfCall(value, self))
}

const paths = /** @type {const} */ ([[false, false], [false, true], [true, false], [true, true]])

export const proof = /** @type {const} */ ({
    parameterizedJoinUsesAnImmutableContinuation: () => {
        const { text, apply } = compiled(_controlFlowFunctions.parameterizedJoin)
        immutable(text)
        assertEq(apply.length, 3)
        assertEq(apply(false, false, identity), 5)
        assertEq(apply(false, true, identity), 5)
        assertEq(apply(true, false, identity), 8)
        assertEq(apply(true, true, () => { throw 'the owning return must skip its continuation' }), 42)
    },
    nestedNormalAndOwningReturnPathsKeepTheirEvaluationOwners: () => {
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
    },
    selectedRequiredFailuresStayOnTheirOriginalPaths: () => {
        const parameterized = compiled(_controlFlowFunctions.parameterizedJoin)
        const nested = compiled(_controlFlowFunctions.nested)
        immutable(parameterized.text)
        immutable(nested.text)
        assertEq(parameterized.apply(true, true, failed), 42)
        throws(() => parameterized.apply(false, false, failed))
        throws(() => parameterized.apply(true, false, failed))
        assertEq(nested.apply(false, 9, failed, identity), 9)
        assertEq(nested.apply(true, 9, () => ({ a: 3, b: true, c: 7 }), failed), 7)
        throws(() => nested.apply(true, 9, failed, identity))
        throws(() => nested.apply(true, 9, () => ({ a: 3, b: false, c: 7 }), failed))
    },
    sharedResultsAndSuffixAllocationsAreFreshPerInvocation: () => {
        const { text, apply } = compiled(_controlFlowFunctions.parameterizedJoin)
        immutable(text)
        let calls = 0
        /** @param {number} value */
        const allocate = value => {
            calls += 1
            const allocation = /** @type {const} */ ([value])
            return [allocation, allocation]
        }
        const first = apply(false, false, allocate)
        const second = apply(true, false, allocate)
        assertEq(first[0], first[1])
        assertEq(second[0], second[1])
        assert(first[0] !== second[0])
        assertStructurallySame(first, [[5], [5]])
        assertStructurallySame(second, [[8], [8]])
        assertEq(calls, 2)

        const source = _controlFlowFunctions.parameterizedJoin
        const allocation = /** @type {const} */ ({ index: 10 })
        /** @type {FastFunction} */
        const suffix = { ...source, body: block(['return', source.target, ['array', [ref(allocation), ref(allocation)]]], [
            ...source.body.statements, ['define', allocation, ['array', [ref(joined(source))]], 'required'],
        ]) }
        const direct = compiled(suffix)
        immutable(direct.text)
        const left = direct.apply(false, false, identity)
        const right = direct.apply(true, false, identity)
        assertEq(left[0], left[1])
        assertEq(right[0], right[1])
        assert(left[0] !== right[0])
        assertStructurallySame(left, [[0], [0]])
        assertStructurallySame(right, [[3], [3]])
        assertEq(direct.apply(true, true, failed), 42)
    },
    requiredPrefixRunsBeforeTheOwningEarlyReturn: () => {
        const source = _controlFlowFunctions.parameterizedJoin
        const initializer = /** @type {const} */ ({ index: 10 })
        const established = /** @type {const} */ ({ index: 11 })
        /** @type {FastFunction} */
        const fn = { ...source, parameters: [...source.parameters, initializer], body: block(['return', source.target,
            ['()', ref(source.parameters[2]), [['array', [ref(established), ref(joined(source)), ref(established)]]]],
        ], [['define', established, ['()', ref(initializer), []], 'required'], ...source.body.statements]) }
        const { text, apply } = compiled(fn)
        immutable(text)
        assertEq(apply.length, 4)
        for (const [selected, stop] of paths) {
            const marker = /** @type {const} */ ([11])
            /** @type {string[]} */
            const calls = []
            const value = apply(selected, stop,
                /** @param {unknown} result */ result => { calls.push('continuation'); return result },
                () => { calls.push('prefix'); return marker },
            )
            if (selected && stop) { assertEq(value, 42); assertStructurallySame(calls, ['prefix']) }
            else {
                assertEq(value[0], marker)
                assertEq(value[2], marker)
                assertEq(value[1], selected ? 3 : 0)
                assertStructurallySame(calls, ['prefix', 'continuation'])
            }
        }
        throws(() => apply(true, true, identity, failed))
    },
    restAndCaptureBindingsKeepTheirInvocationLifetimes: () => {
        const source = _controlFlowFunctions.parameterizedJoin
        const rest = /** @type {const} */ ({ index: 10 })
        const captured = /** @type {const} */ ({ index: 11 })
        /** @type {FastFunction} */
        const fn = { ...source, rest, captures: [{ binding: captured, value: ['array', [4]] }],
            body: block(['return', source.target, ['array', [
                ['()', ref(source.parameters[2]), [['+', ref(joined(source)), 5]]], ref(rest), ref(rest), ref(captured), ref(captured),
            ]]], source.body.statements) }
        const { text, apply, prepared } = compiled(fn, true)
        immutable(text)
        assertEq(prepared.target, fn.target)
        assertEq(prepared.parameters, fn.parameters)
        assertEq(prepared.rest, rest)
        assertEq(prepared.captures[0].binding, captured)
        assertEq(apply.length, 3)
        const first = apply(false, false, identity, 9, 10)
        const second = apply(true, false, identity, 9, 10)
        assertStructurallySame(first, [5, [9, 10], [9, 10], [4], [4]])
        assertStructurallySame(second, [8, [9, 10], [9, 10], [4], [4]])
        assertEq(first[1], first[2])
        assert(first[1] !== second[1])
        assertEq(first[3], first[4])
        assertEq(first[3], second[3])
        assertEq(apply(true, true, failed, 9, 10), 42)
    },
    nestedOrdinaryFunctionsKeepTheirOwnReturnTarget: () => {
        const source = _controlFlowFunctions.parameterizedJoin
        const childTarget = /** @type {const} */ ({ kind: 'function', index: 10 })
        const captured = /** @type {const} */ ({ index: 10 })
        /** @type {FastFunction} */
        const child = { target: childTarget, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(joined(source)) }],
            body: block(['return', childTarget, ['+', ref(captured), 5]]) }
        /** @type {FastFunction} */
        const fn = { ...source, body: block(['return', source.target, ['function', child]], source.body.statements) }
        const { text, apply, prepared } = compiled(fn)
        immutable(text)
        assert(retainsFunctionOwner(prepared.body, childTarget))
        const first = apply(false, false, identity)
        const second = apply(true, false, identity)
        assertEq(first(), 5)
        assertEq(second(), 8)
        assert(first !== second)
        assertEq(apply(true, true, failed), 42)
    },
    graphRecoveryKeepsItsSeparateBoundaryAndOwningSelfTailLoop: () => {
        const graph = graphCompiled(_controlFlowFunctions.parameterizedJoin)
        assertEq(graph.apply(false, false, identity), 5)
        assertEq(graph.apply(false, true, identity), 5)
        assertEq(graph.apply(true, false, identity), 8)
        assertEq(graph.apply(true, true, failed), 42)

        const target = /** @type {const} */ ({ kind: 'function', index: 10 })
        const count = /** @type {const} */ ({ index: 10 })
        const self = /** @type {const} */ ({ index: 11 })
        const next = /** @type {const} */ ({ index: 12 })
        /** @type {FastFunction} */
        const recursive = { target, parameters: [count], rest: null, self, captures: [], body: block(['return', target,
            ['if', ['>', ref(count), 0], block(['yield', [['()', ref(self), [ref(next)]]]]), block(['yield', [0]])],
        ], [['if', [next], ['>', ref(count), 0], block(['yield', [['-', ref(count), 1]]]), block(['yield', [0]])]]) }
        const direct = compiled(recursive)
        assert(direct.prepared.self !== null)
        assert(ownsSelfCall(direct.prepared.body, direct.prepared.self))
        assertEq(direct.apply(3), 0)
        const lowered = graphCompiled(recursive)
        assert(tokenKinds(lowered.text).includes('while'), lowered.text)
        assertEq(lowered.apply(100_001), 0)
    },
})
