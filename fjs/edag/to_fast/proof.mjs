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
import { toFast } from './module.f.mjs'
import { _snapshotCases } from './proof.f.mjs'
import { fromFast } from '../from_fast/module.f.mjs'
import { prepare } from '../../js/ast/prepare/module.f.mjs'
import { stringify } from '../../js/ast/serializer/module.f.mjs'
import { tryStringify } from '../../compiler/serializer/module.f.mjs'
import { parse } from '../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../compiler/edag/module.f.mjs'

/** @type {(graph: Exp) => unknown} */
const execute = graph => Function(`"use strict";return (${stringify(prepare(assertOk(toFast(graph))), 'expression', true)});`)()

export const proof = {
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
        const key = /** @type {const} */ (['{}', [[':', 'toString', ['=>', 0, [], ['throw', 1]]]]])
        const graphs = /** @type {readonly Exp[]} */ ([
            ['[]', [['throw', 1], forever, forever]],
            ['[]', [['?:', true, ['throw', 1], 0], forever, forever]],
            ['[]', [['...', null], forever, forever]],
            ['[]', [['...', null], ['+', 1, 2], ['+', 3, 4], forever, forever]],
            ['[]', [['...', null], forever, another, forever, another]],
            ['()', ['=>', 0, [], 0], [['...', null], forever, forever]],
            ['.', null, 'f', ['|()', [forever, forever]]],
            ['{}', [[':', key, forever], [':', 'again', forever]]],
        ])
        for (const graph of graphs) {
            for (const value of [graph, fromFast(assertOk(toFast(graph)))]) {
                const text = stringify(prepare(assertOk(toFast(value))), 'expression', true)
                throws(() => runInNewContext(`(${text})`, {}, { timeout: 100 }), error =>
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
