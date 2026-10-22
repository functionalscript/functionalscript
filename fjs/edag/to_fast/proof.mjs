/**
 * Established outer graph values stay outer lexical bindings in generated JS.
 * Host compilation exposes both temporal-dead-zone reads and duplicate local
 * declarations, which the graph interpreter's immutable environment tolerates.
 *
 * @import { Exp } from '../types.ts'
 */

import { assertEq, assertOk } from '../../asserts/module.f.js'
import { toFast } from './module.f.mjs'
import { prepare } from '../../js/ast/prepare/module.f.mjs'
import { stringify } from '../../js/ast/serializer/module.f.mjs'
import { tryStringify } from '../../compiler/serializer/module.f.mjs'
import { parse } from '../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../compiler/edag/module.f.mjs'

/** @type {(graph: Exp) => unknown} */
const execute = graph => Function(`"use strict";return (${stringify(prepare(assertOk(toFast(graph))), 'expression', true)});`)()

export const proof = {
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
