/**
 * Execute raw FAST through both JavaScript preparation boundaries. Native
 * function identity and deferred failures cannot be observed by inspecting
 * prepared text; represented graph evaluation supplies a separate comparison.
 * All inputs are immutable FAST values, including lexical self-ID shadowing.
 *
 * @import { BindingId, Block, Definition, Function as FastFunction, Statement, Value } from '../types.ts'
 */

import { throws } from 'node:assert/strict'

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { prepare, prepareFunction } from './module.f.mjs'
import { functionStringify, stringify } from '../serializer/module.f.mjs'

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })

/** @type {(value: Value) => Value} */
const capturedValue = value => {
    const target = /** @type {const} */ ({ kind: 'function', index: 1 })
    const binding = /** @type {const} */ ({ index: 0 })
    return ['function', { target, parameters: [], rest: null, self: null,
        captures: [{ binding, value }], body: block(['return', target, ref(binding)]) }]
}

/**
 * The alias is established before the original self ID becomes a value of 7.
 * A retained recipe first demands that alias after the shadow is established.
 * @type {(options: {
 *     readonly kind: 'loop' | 'loopResult' | 'define' | 'block' | 'if'
 *     readonly mode: Definition[3]
 *     readonly captured?: boolean
 *     readonly recipe?: boolean
 *     readonly identity?: boolean
 *     readonly failure?: boolean
 * }) => FastFunction}
 */
const fixture = ({ kind, mode, captured = false, recipe = false, identity = false, failure = false }) => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const self = /** @type {const} */ ({ index: 0 })
    const alias = /** @type {const} */ ({ index: 1 })
    const selected = /** @type {const} */ ({ index: 2 })
    const cell = /** @type {const} */ ({ index: 3 })
    const kept = /** @type {const} */ ({ index: 4 })
    const output = /** @type {const} */ ({ index: 5 })
    const failed = /** @type {const} */ ({ index: 6 })
    const value = captured ? capturedValue(ref(alias)) : ref(alias)
    /** @type {Value} */
    const contents = ['array', [value]]
    /** @type {Value} */
    const initializer = failure ? ['block', block(['yield', [contents]], [
        ['define', failed, ['+', 1, 1n], 'required'],
    ])] : contents
    /** @type {Value} */
    const retained = recipe ? ['.', ref(kept), 0] : value
    /** @type {Value} */
    const observed = captured ? ['()', retained, []] : retained
    /** @type {Value} */
    const result = identity ? ['array', [observed, ref(self)]] : ['===', observed, ref(self)]
    const seven = block(['yield', [7]])
    /** @type {readonly Definition[]} */
    const retainedDefinitions = recipe ? [['define', kept, initializer, 'lazy']] : []
    /** @type {readonly Statement[]} */
    const shadow = kind === 'loop'
        ? [['loop', { target: loop, parameters: [self], initial: [7], results: [output],
            body: block(['break', loop, [result]]) }]]
        : kind === 'loopResult' ? [['loop', { target: loop, parameters: [], initial: [], results: [self],
            body: block(['break', loop, [7]]) }]]
            : kind === 'define' ? [['define', self, 7, 'required']]
                : kind === 'block' ? [['block', [self], seven]]
                    : [['if', [self], true, seven, block(['yield', [9]])]]
    return { target, parameters: [selected], rest: null, self, captures: [], body: block([
        'return', target, kind === 'loop' ? ref(output) : result,
    ], [
        ['define', alias, ref(self), mode],
        ...retainedDefinitions,
        ['define', cell, ['block', block(['return', target, 23])], 'lazy'],
        ['if', [], ref(selected), block(['return', target, ref(cell)]), block(['yield', []])],
        ...shadow,
    ]) }
}

/** @type {(fn: FastFunction) => (...args: readonly unknown[]) => any} */
const wholeBlock = fn => Function(`"use strict";return ${stringify(prepare(block(['yield', [['function', fn]]])), 'expression', true)};`)()

/** Standalone external function text has no capture inputs in these fixtures.
 * @type {(fn: FastFunction) => (...args: readonly unknown[]) => any}
 */
const standalone = fn => Function(`"use strict";return (${functionStringify(prepareFunction(fn))});`)()

/** One established callable makes the returned-self comparison meaningful.
 * @type {(fn: FastFunction, selected: boolean, identity?: boolean) => import('../../../edag/value/control/types.ts').ValueResult}
 */
const represented = (fn, selected, identity = false) => {
    const callee = /** @type {const} */ ({ index: 0 })
    const result = /** @type {const} */ ({ index: 0 })
    /** @type {Value} */
    const output = identity && !selected ? ['array', [
        ['===', ['.', ref(result), 0], ref(callee)], ['.', ref(result), 1],
    ]] : ref(result)
    const graph = fromFast(block(['yield', [output]], [
        ['define', callee, ['function', fn], 'required'],
        ['define', result, ['()', ref(callee), [selected]], 'required'],
    ]))
    return memo(assertOk(identityAnalysis(graph)))({ args: [] })
}

/** @type {(fn: FastFunction, selected: boolean, identity?: boolean) => unknown} */
const evaluated = (fn, selected, identity = false) => assertOk(toData(assertOk(represented(fn, selected, identity))))

const kinds = /** @type {const} */ (['loop', 'loopResult', 'define', 'block', 'if'])
const modes = /** @type {const} */ (['required', 'lazy'])
const renders = /** @type {const} */ ([wholeBlock, standalone])

export const proof = /** @type {const} */ ({
    selfAliasesSurviveEveryShadowingBinder: () => {
        for (const kind of kinds) {
            for (const mode of modes) {
                const fn = fixture({ kind, mode })
                assertEq(evaluated(fn, false), false)
                assertEq(evaluated(fn, true), 23)
                for (const render of renders) {
                    const apply = render(fn)
                    assertEq(apply.length, 1)
                    assertEq(apply(false), false)
                    assertEq(apply(true), 23)
                }
            }
        }
    },
    nestedCapturesKeepTheirEstablishedSelfAlias: () => {
        for (const kind of kinds) {
            for (const mode of modes) {
                const fn = fixture({ kind, mode, captured: true })
                assertEq(evaluated(fn, false), false)
                assertEq(evaluated(fn, true), 23)
                for (const render of renders) {
                    const apply = render(fn)
                    assertEq(apply(false), false)
                    assertEq(apply(true), 23)
                }
            }
        }
    },
    aliasesReturnThePublicFunctionBesideTheShadowedValue: () => {
        for (const kind of kinds) {
            for (const mode of modes) {
                for (const captured of [false, true]) {
                    const fn = fixture({ kind, mode, captured, identity: true })
                    assertStructurallySame(evaluated(fn, false, true), [true, 7])
                    for (const render of renders) {
                        const apply = render(fn)
                        const result = apply(false)
                        assertEq(result[0], apply)
                        assertEq(result[1], 7)
                        assertEq(apply(true), 23)
                    }
                }
            }
        }
    },
    retainedLazyArraysDemandAliasesAfterTheShadow: () => {
        for (const kind of kinds) {
            for (const mode of modes) {
                for (const captured of [false, true]) {
                    const fn = fixture({ kind, mode, captured, recipe: true, identity: true })
                    assertStructurallySame(evaluated(fn, false, true), [true, 7])
                    for (const render of renders) {
                        const apply = render(fn)
                        const result = apply(false)
                        assertEq(result[0], apply)
                        assertEq(result[1], 7)
                        assertEq(apply(true), 23)
                    }
                }
            }
        }
    },
    deferredPrefixesRunOnlyAtTheirSelectedDemand: () => {
        for (const kind of kinds) {
            for (const mode of modes) {
                for (const captured of [false, true]) {
                    const fn = fixture({ kind, mode, captured, recipe: true, failure: true })
                    assertEq(evaluated(fn, true), 23)
                    assertError(represented(fn, false))
                    for (const render of renders) {
                        const apply = render(fn)
                        assertEq(apply(true), 23)
                        throws(() => apply(false))
                    }
                }
            }
        }
    },
})
