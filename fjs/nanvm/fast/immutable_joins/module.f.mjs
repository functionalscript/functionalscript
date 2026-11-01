/**
 * Execute direct FAST and full graph-route joins in the native Rust harness.
 * Both routes share the same control-flow inputs. A genuine self-tail loop
 * checks that graph wrapper recovery retains ordinary iteration.
 *
 * @module
 * @import { Function as FastFunction, Value } from '../../../js/ast/types.ts'
 * @import { Scope } from '../../../rust/serializer/types.ts'
 */

import { _controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { functionStringify } from '../../../js/ast/serializer/module.f.mjs'
import { scope, useLines } from '../../../rust/serializer/module.f.mjs'
import { indent } from '../../../media/rust/item/module.f.js'
import { unwrap } from '../../../types/result/module.f.js'

export const path = /** @type {const} */ ('nanvm/harness/gen.fast/immutable_joins.rs')

/** One normal continuation allocates once, shares it, and captures it.
 * @type {() => FastFunction}
 */
const operation = () => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const nested = /** @type {const} */ ({ kind: 'function', index: 0 })
    const input = /** @type {const} */ ({ index: 0 })
    const allocation = /** @type {const} */ ({ index: 0 })
    const held = /** @type {const} */ ({ index: 0 })
    return { target, parameters: [input], rest: null, self: null, captures: [], body: {
        statements: [['define', allocation, ['array', [['ref', input]]], 'required']],
        exit: ['return', target, ['array', [
            ['ref', allocation], ['ref', allocation], ['function', {
                target: nested, parameters: [], rest: null, self: null,
                captures: [{ binding: held, value: ['ref', allocation] }],
                body: { statements: [], exit: ['return', nested, ['ref', held]] },
            }],
        ]]],
    } }
}

/** @type {(early: boolean) => FastFunction} */
const factory = early => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    return { target, parameters: [], rest: null, self: null, captures: [], body: {
        statements: [], exit: ['return', target, ['object', [[':', 'a', 3], [':', 'b', early], [':', 'c', 77]]]],
    } }
}

/** A selected failure checks that an earlier owning return skips its caller.
 * @type {() => FastFunction}
 */
const failing = () => ({ target: { kind: 'function', index: 0 }, parameters: [], rest: null, self: null, captures: [],
    body: { statements: [], exit: ['throw', 'selected callback'] } })

/** Graph construction and placement leave callable bodies unevaluated.
 * @type {(fn: FastFunction) => Value}
 */
const graphFunction = fn => ['block', fromAnalysis(unwrap(identityAnalysis(fromFast({
    statements: [], exit: ['yield', [['function', fn]]],
}))))]

/** A genuine backedge must remain bounded rather than become a one-pass join.
 * @type {() => FastFunction}
 */
const tailSum = () => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const self = /** @type {const} */ ({ index: 0 })
    const n = /** @type {const} */ ({ index: 0 })
    const total = /** @type {const} */ ({ index: 0 })
    return { target, parameters: [n, total], rest: null, self, captures: [], body: {
        statements: [], exit: ['return', target, ['if', ['>', ['ref', n], 0],
            { statements: [], exit: ['yield', [['()', ['ref', self], [['-', ['ref', n], 1], ['+', ['ref', total], 1]]]]] },
            { statements: [], exit: ['yield', [['ref', total]]] },
        ]],
    } }
}

/** @type {(iterations: boolean) => Value} */
const exports = iterations => ['object', [
    [':', 'parameterizedJoin', ['function', _controlFlowFunctions.parameterizedJoin]],
    [':', 'nested', ['function', _controlFlowFunctions.nested]],
    [':', 'graphParameterizedJoin', graphFunction(_controlFlowFunctions.parameterizedJoin)],
    [':', 'graphNested', graphFunction(_controlFlowFunctions.nested)],
    [':', 'operation', ['function', operation()]],
    [':', 'factoryNormal', ['function', factory(false)]],
    [':', 'factoryEarly', ['function', factory(true)]],
    [':', 'failing', ['function', failing()]],
    ...iterations ? [/** @type {const} */ ([':', 'graphTailSum', graphFunction(tailSum())])] : [],
]]

/** @type {(iterations: boolean) => Scope} */
const rendered = iterations => unwrap(scope(prepare({ statements: [], exit: ['yield', [exports(iterations)]] }),
    { runtime: null, text: functionStringify }))

/** Inspect only noniterative witnesses when asserting immutable storage.
 * @type {() => string}
 */
export const _joinBody = () => rendered(false).lines.join('\n')

/** Emit the prepared instructions through the existing Rust serializer.
 * @type {() => string}
 */
export const generate = () => {
    const { lines, uses } = rendered(true)
    return [
        '// Fixture source: `fjs/nanvm/fast/immutable_joins/module.f.mjs`; regenerate with `npm run gen`.',
        '',
        ...useLines(uses, 'IStaticFunction'),
        '',
        '#[rustfmt::skip]',
        '#[allow(clippy::if_same_then_else)]',
        'pub fn module<A: IStaticFunction>(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {',
        ...lines.map(line => line.trimEnd()).map(line => line === '' ? '' : `${indent}${line}`),
        '}',
        '',
    ].join('\n')
}
