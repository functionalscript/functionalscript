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
}
