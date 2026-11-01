/**
 * Execute common FAST preparation directly in the native Rust harness.
 * The shared control-flow inputs never pass through graph reconstruction;
 * otherwise that stage could recover the join before preparation sees it.
 *
 * @module
 * @import { Function as FastFunction, Value } from '../../../js/ast/types.ts'
 */

import { _controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
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

/** @type {() => Value} */
const exports = () => ['object', [
    [':', 'parameterizedJoin', ['function', _controlFlowFunctions.parameterizedJoin]],
    [':', 'nested', ['function', _controlFlowFunctions.nested]],
    [':', 'operation', ['function', operation()]],
    [':', 'factoryNormal', ['function', factory(false)]],
    [':', 'factoryEarly', ['function', factory(true)]],
    [':', 'failing', ['function', failing()]],
]]

/** Emit the prepared instructions through the existing Rust serializer.
 * @type {() => string}
 */
export const generate = () => {
    const prepared = prepare({ statements: [], exit: ['yield', [exports()]] })
    const { lines, uses } = unwrap(scope(prepared, { runtime: null, text: functionStringify }))
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
