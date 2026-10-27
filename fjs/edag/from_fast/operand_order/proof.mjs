/**
 * Native execution observes failure classes and can bound an infinite loop.
 * FunctionalScript cannot interrupt its own divergent computation; ordinary
 * finite results and sharing stay in the sibling FunctionalScript proof.
 *
 * @import { Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { throws } from 'node:assert/strict'
import { runInNewContext } from 'node:vm'

import { assertOk } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify } from '../../../js/ast/serializer/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _body as body } from '../proof.f.mjs'
import { _anchored as anchored, _consumers as consumers, _convert as convert, _graphs as graphs, _invalid as invalid, _loopEntry as loopEntry } from './proof.f.mjs'

/** @type {(graph: Exp) => string} */
const text = graph => stringify(prepare(assertOk(toFast(graph))), 'expression', true)

/** A source-shaped loop, rather than native recursion with a finite stack. @type {() => Value} */
const forever = () => {
    const state = id(0), output = id(0)
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const loop = /** @type {Loop} */ ({ target, parameters: [state], initial: [0], results: [output], body: body(['continue', target, [ref(state)]]) })
    return ['block', result(ref(output), [['loop', loop]])]
}

/** @type {(error: unknown) => boolean} */
const typeError = error => error !== null && typeof error === 'object' && 'name' in error && error.name === 'TypeError'

export const proof = {
    suppliedGraphsKeepNativeFailureClasses: () => {
        for (const [index, [graph]] of graphs.entries()) {
            for (const current of [graph, convert(graph), convert(convert(graph))]) {
                const source = text(current)
                throws(() => runInNewContext(`(${source})`, {}, { timeout: 100 }), index === 0 ? typeError : error => error === 'earlier')
            }
        }
    },
    earlierDivergencePrecedesLaterOperandAnchors: () => {
        for (const value of consumers(forever())) {
            const direct = stringify(prepare(result(value)), 'expression', true)
            throws(() => runInNewContext(`(${direct})`, {}, { timeout: 100 }), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })
            const graph = fromFast(result(value))
            for (const current of [graph, convert(graph)]) {
                const source = text(current)
                throws(() => runInNewContext(`(${source})`, {}, { timeout: 100 }), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })
            }
        }
    },
    earlierFailurePrecedesLaterAnchoredDivergence: () => {
        for (const value of consumers(invalid, anchored(1, forever()))) {
            const direct = stringify(prepare(result(value)), 'expression', true)
            throws(() => runInNewContext(`(${direct})`, {}, { timeout: 100 }), typeError)
            const graph = fromFast(result(value))
            for (const current of [graph, convert(graph)]) {
                const source = text(current)
                throws(() => runInNewContext(`(${source})`, {}, { timeout: 100 }), typeError)
            }
        }
    },
    externalLoopCapturesPrecedeEntryAnchors: () => {
        const { external, block } = loopEntry()
        const graph = fromFast(block, [[external, fromFast(result(forever()))]])
        for (const current of [graph, convert(graph)]) {
            const source = text(current)
            throws(() => runInNewContext(`(${source})`, {}, { timeout: 100 }), { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' })
        }
    },
}
