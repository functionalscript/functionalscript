/**
 * Established outer graph values stay outer lexical bindings in generated JS.
 * Host compilation exposes both temporal-dead-zone reads and duplicate local
 * declarations, which the graph interpreter's immutable environment tolerates.
 * Bounded native execution also distinguishes divergence from a reached
 * failure; FunctionalScript cannot interrupt its own divergent computation.
 *
 * @import { Exp } from '../types.ts'
 */

import { throws } from 'node:assert/strict'
import { runInNewContext } from 'node:vm'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { toFast } from './module.f.js'
import { _snapshotCases } from './proof.f.js'
import { fromFast } from '../from_fast/module.f.js'
import { prepare } from '../../js/ast/prepare/module.f.js'
import { stringify } from '../../js/ast/serializer/module.f.js'
import { tryFunctionText, tryStringify } from '../../compiler/serializer/module.f.js'
import { parse } from '../../compiler/transpiler/module.f.js'
import { _defaultExport, unresolved } from '../../compiler/edag/module.f.js'

/** @type {(graph: Exp) => unknown} */
const execute = graph => Function(`"use strict";return (${stringify(prepare(assertOk(toFast(graph))), 'expression', true)});`)()

export const proof = {
    groupMembersRetainPeersAndTheirFrame: () => {
        const group = /** @type {const} */ (['group', [['arg', 0]], [
            [1, ['=>', 0, [['self', 1], ['arg', 0]], ['[]', [['frame', 0], ['frame', 1]]]]],
            [0, ['[]', [['self', 0], ['frame', 0], ['rest']]]],
        ]])
        const graph = /** @type {const} */ (['=>', 1, [], ['[]', [['fn', group, 0], ['fn', group, 1]]]])
        const source = assertOk(tryStringify(graph))
        const readBack = _defaultExport(unresolved(assertOk(parse('/group.f.js')(source))).edag)
        for (const factory of [execute(graph), execute(fromFast(assertOk(toFast(graph)))), execute(readBack), Function(`return ${source.slice('export default '.length)}`)()]) {
            const [first, second] = factory('outer')
            const [again, captured, rest] = second(1, 2)
            assertEq(again, first)
            assertEq(captured, 'outer')
            assertStructurallySame(rest, [1, 2])
            const [other, arg] = first('inner')()
            assertEq(other, second)
            assertEq(arg, 'inner')
            assertEq(first.length, 1)
            assertEq(factory('next')[1]()[1], 'next')
        }
    },
    aProjectionAloneDeclaresEveryMember: () => {
        const group = /** @type {const} */ (['group', [], [[0, ['self', 1]], [0, ['self', 0]]]])
        const graph = /** @type {const} */ (['fn', group, 1])
        const value = /** @type {() => () => unknown} */ (execute(graph))
        assertEq(value()(), value)
        assertEq(assertOk(tryFunctionText(graph)), '()=>$0')
        assertEq(assertOk(tryStringify(graph)), 'const $0=()=>$1;const $1=()=>$0;export default $1;')
    },
    lazyProjectionsDemandOneFrame: () => {
        const group = /** @type {const} */ (['group', [['()', ['arg', 0], []]], [
            [0, ['[]', [['self', 1], ['frame', 0]]]], [0, ['self', 0]],
        ]])
        const graph = /** @type {const} */ (['=>', 2, [], ['[]', [
            ['?:', ['arg', 1], ['fn', group, 0], 0], ['?:', ['arg', 1], ['fn', group, 1], 0],
        ]]])
        const make = /** @type {(capture: () => string, select: boolean) => readonly [() => readonly [unknown, string], () => unknown]} */ (execute(graph))
        let calls = 0
        const capture = () => { calls += 1; return 'captured' }
        assertStructurallySame(make(capture, false), [0, 0])
        assertEq(calls, 0)
        const [first, second] = make(capture, true)
        assertEq(first()[0], second)
        assertEq(first()[1], 'captured')
        assertEq(second(), first)
        assertEq(calls, 1)
    },
    snapshotsKeepEarlierLazyDependencies: () => {
        for (const initial of _snapshotCases()) {
            let graph = initial
            for (let round = 0; round < 4; round += 1) {
                const values = execute(graph)
                assertStructurallySame(values, [['x', [3]], [3], 'x,31', 'x,31'])
                assert(Array.isArray(values) && Array.isArray(values[0]))
                assertEq(values[0][1], values[1])
                graph = fromFast(assertOk(toFast(graph)))
            }
        }
    },
    laterSharedFailuresStayAfterDivergence: () => {
        const forever = /** @type {const} */ (['()', ['=>', 0, [], ['()', ['self'], []]], []])
        const failure = /** @type {const} */ (['throw', 2])
        const containing = /** @type {const} */ (['[]', [forever, failure]])
        const graphs = /** @type {readonly Exp[]} */ ([
            ['[]', [forever, failure, failure]],
            ['[]', [['?:', true, forever, 0], failure, failure]],
            ['[]', [forever, ['[]', [failure, failure]]]],
            ['[]', [containing, containing, failure]],
        ])
        for (const graph of graphs) {
            for (const value of [graph, fromFast(assertOk(toFast(graph)))]) {
                const text = stringify(prepare(assertOk(toFast(value))), 'expression', true)
                throws(() => runInNewContext(`(${text})`, {}, { timeout: 100 }), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })
            }
        }
    },
    earlierFailuresStayBeforeSharedDivergence: () => {
        const forever = /** @type {const} */ (['()', ['=>', 0, [], ['()', ['self'], []]], []])
        const another = /** @type {const} */ (['()', forever[1], []])
        // An operation's own failure and a selected operand stay barriers. An
        // expansion, a lookup and a key's conversion are none: a shared
        // divergence after one may be established first, and the program
        // fails either way, so those are no cases here.
        const graphs = /** @type {readonly Exp[]} */ ([
            ['[]', [['throw', 1], forever, forever]],
            ['[]', [['?:', true, ['throw', 1], 0], forever, forever]],
            ['[]', [['throw', 1], forever, another, forever, another]],
        ])
        for (const graph of graphs) {
            for (const value of [graph, fromFast(assertOk(toFast(graph)))]) {
                const text = stringify(prepare(assertOk(toFast(value))), 'expression', true)
                // This bounds a misplaced divergence, not exception latency.
                // Loaded CI runners need room to reach the required failure.
                throws(() => runInNewContext(`(${text})`, {}, { timeout: 1_000 }), error =>
                    error === 1 || error !== null && typeof error === 'object' && 'name' in error && error.name === 'TypeError')
            }
        }
    },
    localSharedSourceRetainsOrderAndFixedPoint: () => {
        const source = 'const forever=n=>{let i=n;while(true){i=i+1;}return i;};export default[forever(0),(()=>{const bad=null.x;return[bad,bad];})()];'
        let graph = _defaultExport(unresolved(assertOk(parse('/shared-owner.f.js')(source))).edag)
        let written = assertOk(tryStringify(graph))
        for (let i = 0; i < 4; i += 1) {
            const text = stringify(prepare(assertOk(toFast(graph))), 'expression', true)
            throws(() => runInNewContext(`(${text})`, {}, { timeout: 100 }), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })
            graph = _defaultExport(unresolved(assertOk(parse('/shared-owner.f.js')(written))).edag)
            const next = assertOk(tryStringify(graph))
            assertEq(next, written)
            written = next
        }
    },
    sharedOwnersRetainFreshCaptureLifetimes: () => {
        const shared = /** @type {const} */ (['[]', [7]])
        const closure = /** @type {const} */ (['=>', 0, [shared], ['frame', 0]])
        const fn = /** @type {const} */ (['=>', 0, [], ['[]', [['()', ['=>', 0, [], 0], []], shared, shared, closure]]])
        const graph = /** @type {Exp} */ (['[]', [['()', fn, []], ['()', fn, []]]])
        for (const value of [graph, fromFast(assertOk(toFast(graph)))]) {
            const values = /** @type {readonly (readonly unknown[])[]} */ (execute(value))
            for (const result of values) {
                assertEq(result[1], result[2])
                assertEq(/** @type {() => unknown} */ (result[3])(), result[1])
            }
            assertEq(values[0][1] === values[1][1], false)
        }
    },
    movableClosuresRetainEstablishedCaptureValues: () => {
        const captured = /** @type {const} */ (['[]', [7]])
        const closure = /** @type {const} */ (['=>', 0, [captured], ['frame', 0]])
        const values = /** @type {readonly unknown[]} */ (execute(['[]', [captured, ['()', closure, []]]]))
        assertEq(values[0], values[1])
        const fn = /** @type {(value: number) => readonly unknown[]} */ (execute(['=>', 1, [], ['[]', [0, ['()', ['=>', 0, [['arg', 0]], ['frame', 0]], []]]]]))
        assertEq(fn(9)[1], 9)
    },
    laterCalleeAndCaptureKeepTheirOperandOrder: () => {
        const forever = /** @type {Exp} */ (['()', ['=>', 1, [], ['()', ['self'], [['arg', 0]]]], [0]])
        const callee = /** @type {Exp} */ (['()', ['throw', 2], []])
        const coercion = /** @type {Exp} */ (['-', ['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 2]]]]]])
        const capture = /** @type {Exp} */ (['=>', 0, [coercion], ['frame', 0]])
        for (const later of [callee, capture]) {
            const graph = /** @type {Exp} */ (['[]', [forever, later]])
            const written = assertOk(tryStringify(graph))
            const restored = _defaultExport(unresolved(assertOk(parse('/operand-order.f.js')(written))).edag)
            for (const value of [graph, restored]) {
                const text = stringify(prepare(assertOk(toFast(value))), 'expression', true)
                throws(() => runInNewContext(`(${text})`, {}, { timeout: 100 }), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })
            }
            const reversed = /** @type {Exp} */ (['[]', [later, forever]])
            const text = stringify(prepare(assertOk(toFast(reversed))), 'expression', true)
            throws(() => runInNewContext(`(${text})`, {}, { timeout: 100 }), error => error === 2)
        }
    },
    enclosingCallAndCaptureBindings: () => {
        const fn = /** @type {const} */ (['=>', 0, [], 7])
        assertEq(execute([',', [fn, ['?:', true, ['()', fn, []], 0]]]), 7)
        assertEq(execute([',', [fn, ['?:', true, [',', [
            ['()', fn, []], [',', [['()', fn, []], ['()', fn, []]]],
        ]], 0]]]), 7)
        const captured = /** @type {const} */ (['[]', [1]])
        const closure = /** @type {const} */ (['=>', 0, [captured], ['frame', 0]])
        assertEq(execute([',', [captured, ['===', ['?:', true, ['()', closure, []], ['undefined']], captured]]]), true)
    },
    enclosingSourceBindings: async () => {
        for (const condition of [false, true]) {
            const sources = [
                `const f=()=>1;export default [${condition}&&f(),f];`,
                `const a=[];const f=()=>a;export default [${condition}&&f(),a,f];`,
            ]
            for (const [index, source] of sources.entries()) {
                const graph = _defaultExport(unresolved(assertOk(parse('/owner.f.js')(source))).edag)
                const written = assertOk(tryStringify(graph))
                const module = await import(`data:text/javascript,${encodeURIComponent(written)}`)
                for (const value of [execute(graph), module.default]) {
                    const result = /** @type {readonly [unknown, unknown, (() => unknown)?]} */ (value)
                    if (index === 0) {
                        assertEq(result[0], condition ? 1 : false)
                        assertEq(/** @type {() => number} */ (result[1])(), 1)
                    } else {
                        assertEq(result[0], condition ? result[1] : false)
                        assertEq(/** @type {() => unknown} */ (result[2])(), result[1])
                    }
                }
            }
        }
    },
}
