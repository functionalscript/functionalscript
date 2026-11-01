/**
 * Prepared capture expressions must survive source closure construction.
 * Positional runtime function text retains its separate external-capture ABI.
 *
 * @import { BindingId } from '../types.ts'
 * @import { Block, Capture, Function as PreparedFunction, Statement, Value } from '../prepare/types.ts'
 * @import { ValueResult } from '../../../edag/value/control/types.ts'
 * @import { Values } from '../../../edag/value/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { invoke, memo } from '../../../edag/memo/module.f.mjs'
import { call } from '../../../edag/value/call/module.f.mjs'
import { read } from '../../../edag/value/property/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { ok } from '../../../types/result/module.f.js'
import { _defaultExport, unresolved } from '../../../compiler/edag/module.f.mjs'
import { parse } from '../../../compiler/source/module.f.mjs'
import { functionStringify, stringify } from './module.f.mjs'

const target = /** @type {const} */ ({ kind: 'function', index: 0 })
const first = /** @type {const} */ ({ index: 0 })
const second = /** @type {const} */ ({ index: 0 })
const third = /** @type {const} */ ({ index: 0 })
const fourth = /** @type {const} */ ({ index: 0 })
const parameter = /** @type {const} */ ({ index: 0 })
const outer = /** @type {const} */ ({ index: 0 })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(captures: readonly Capture[], value: Value) => PreparedFunction} */
const fn = (captures, value) => ({ target, parameters: [], rest: null, self: null, captures,
    body: { statements: [], exit: ['return', target, value] } })

/** @type {(fn: PreparedFunction, statements?: readonly Statement[]) => Block} */
const moduleOf = (fn, statements = []) => ({ statements, exit: ['yield', [['function', fn]]] })

/** Read actual source syntax, then execute the closure's construction.
 * @type {(block: Block) => ValueResult}
 */
const evaluate = block => {
    const module = unresolved(assertOk(parse('/prepared-primitive-captures.f.js')(stringify(block))))
    assertEq(module.imports.length, 0)
    return memo(assertOk(identityAnalysis(_defaultExport(module.edag))))({ args: [] })
}

/** @type {(block: Block, args: Values) => ValueResult} */
const invokeModule = (block, args) => call(evaluate(block), args.map(value => () => ok(value)), invoke)

export const proof = /** @type {const} */ ({
    literalAndOperationCapturesBecomeEstablishedArguments: () => {
        const literal = fn([{ binding: first, value: 42 }], ['+', ref(first), ref(parameter)])
        /** @type {PreparedFunction} */
        const apply = { ...literal, parameters: [parameter] }
        assertEq(assertOk(invokeModule(moduleOf(apply), [3])), 45)
        const operation = fn([{ binding: first, value: ['+', 2, 3] }], ref(first))
        assertEq(assertOk(invokeModule(moduleOf(operation), [])), 5)
    },
    mixedAndRepeatedReferencesKeepTheirCapturePositions: () => {
        const captured = fn([
            { binding: first, value: 42 }, { binding: second, value: ref(outer) },
            { binding: third, value: 42 }, { binding: fourth, value: ref(outer) },
        ], ['array', [ref(second), ref(fourth), ref(first), ref(third)]])
        const result = invokeModule(moduleOf(captured, [['define', outer, ['array', [7]]]]), [])
        assertEq(assertOk(read(result, '0')), assertOk(read(result, '1')))
        assertStructurallySame(assertOk(toData(assertOk(result))), [[7], [7], 42, 42])
        const repeated = fn([{ binding: first, value: ref(outer) }, { binding: second, value: ref(outer) }],
            ['array', [ref(first), ref(second)]])
        const aliases = invokeModule(moduleOf(repeated, [['define', outer, ['array', [9]]]]), [])
        assertEq(assertOk(read(aliases, '0')), assertOk(read(aliases, '1')))
    },
    unusedCaptureFailuresStillOccurDuringConstruction: () => {
        const captured = fn([{ binding: first, value: ['+', 1, 1n] }], 7)
        assertError(evaluate(moduleOf(captured)))
    },
    sourceSelfAndRestRemainBoundInsideTheCaptureWrapper: () => {
        const self = /** @type {const} */ ({ index: 0 })
        const rest = /** @type {const} */ ({ index: 0 })
        const binding = /** @type {const} */ ({ index: 0 })
        /** @type {PreparedFunction} */
        const captured = { ...fn([{ binding: first, value: 3 }], ['array', [ref(self), ref(first), ref(parameter), ref(rest)]]),
            parameters: [parameter], rest, self }
        /** @type {Block} */
        const program = { statements: [['define', binding, ['function', captured]]], exit: ['yield', [ref(binding)]] }
        const closure = evaluate(program)
        const result = call(closure, [5, 6, 7].map(value => () => ok(value)), invoke)
        assertEq(assertOk(read(result, '0')), assertOk(closure))
        assertEq(assertOk(read(result, '1')), 3)
        assertEq(assertOk(read(result, '2')), 5)
        assertStructurallySame(assertOk(toData(assertOk(read(result, '3')))), [6, 7])
    },
    wideCaptureFactoriesKeepValuesSelfAndPublicArity: () => {
        for (const width of [17, 32]) {
            const bindings = Array.from({ length: width }, (_, index) => ({ index }))
            const values = Array.from({ length: width }, (_, index) => index)
            for (const keepSelf of [false, true]) {
                const self = /** @type {const} */ ({ index: 0 })
                /** @type {PreparedFunction} */
                const captured = { ...fn(bindings.map((binding, index) => ({ binding, value: values[index] })),
                    ['array', [...bindings.map(ref), ...keepSelf ? [ref(self)] : []]]), parameters: [parameter], self: keepSelf ? self : null }
                const program = moduleOf(captured)
                const closure = evaluate(program)
                const value = assertOk(closure)
                assert(value instanceof Array && value[0] === '=>')
                assertEq(value[1], 1)
                const result = call(closure, [() => ok(9)], invoke)
                for (const [index, expected] of values.entries()) { assertEq(assertOk(read(result, String(index))), expected) }
                if (keepSelf) { assertEq(assertOk(read(result, String(width))), value) }
                const runtime = stringify(program, 'module', true)
                assert(!runtime.includes('...'), runtime)
            }
        }
    },
    externalFunctionTextKeepsPositionalCaptureNames: () => {
        const captures = fn([
            { binding: first, value: 42 }, { binding: second, value: ['+', 2, 3] },
            { binding: third, value: ref(outer) },
        ], ['array', [ref(third), ref(first), ref(second)]])
        assertEq(functionStringify(captures), '()=>[$2,$0,$1]')
        assertEq(functionStringify({ ...captures, captures: [
            { binding: first, value: undefined }, { binding: second, value: null },
            { binding: third, value: 7n },
        ] }), functionStringify(captures))
    },
    emptyAndReferenceOnlyCapturesKeepTheirEstablishedSpelling: () => {
        assertEq(stringify(moduleOf(fn([], 7))), 'export default ()=>7;')
        const captured = fn([{ binding: first, value: ref(outer) }], ref(first))
        const program = moduleOf(captured, [['define', outer, 42]])
        assertEq(stringify(program), 'const $0=42;export default ()=>$0;')
        assertEq(stringify(program, 'module', true), stringify(program))
        assertEq(assertOk(invokeModule(program, [])), 42)
    },
})
