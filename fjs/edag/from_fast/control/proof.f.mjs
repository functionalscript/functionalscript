/**
 * Helper inventories preserve lexical identities and order while respecting
 * ordinary function boundaries. Escape facts retain unreachable syntax and
 * distinguish normal loop exits from enclosing control transfers.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { freeBindings, freeLoopBindings } from './module.f.mjs'

const a = { index: 0 }
const b = { index: 1 }
const c = { index: 2 }
const local = { index: 3 }
const result = { index: 4 }
const state = { index: 5 }
const innerState = { index: 6 }
const innerResult = { index: 7 }
const target = /** @type {const} */ ({ kind: 'function', index: 0 })
const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })

/** @type {(value: Value) => Block} */
const yielding = value => ({ statements: [], exit: ['yield', [value]] })

/** @type {(captures: FastFunction['captures'], body: Block) => Value} */
const fn = (captures, body) => ['function', { target: nestedTarget, parameters: [], rest: null, self: null, captures, body }]

/** @type {(value: Value) => Block} */
const returning = value => ({ statements: [], exit: ['return', target, value] })

/** @type {(value: Value) => Block} */
const nestedReturning = value => ({ statements: [], exit: ['return', nestedTarget, value] })

/** @type {(bindings: readonly BindingId[], expected: readonly BindingId[]) => void} */
const identities = (bindings, expected) => {
    assertEq(bindings.length, expected.length)
    bindings.forEach((binding, i) => assertEq(binding, expected[i]))
}

export const proof = {
    references: () => {
        const value = /** @type {Value} */ (['array', [
            ['ref', b],
            ['ref', a],
            ['ref', b],
            fn([{ binding: local, value: ['ref', c] }], nestedReturning(['ref', local])),
            ['block', { statements: [['define', local, ['ref', a], 'required']], exit: ['yield', [['ref', local]]] }],
            ['if', ['ref', b], yielding(['ref', a]), yielding(['ref', c])],
            null,
        ]])
        identities(freeBindings(yielding(value)), [b, a, c])
        identities(freeBindings(yielding(value), [a, b, c]), [])
        identities(freeBindings(yielding(undefined)), [])
        const sameIndex = { index: a.index }
        identities(freeBindings(yielding(['array', [['ref', a], ['ref', sameIndex]]])), [a, sameIndex])
    },
    deepOperators: () => {
        const value = Array.from({ length: 20_000 }).reduce((/** @type {Value} */ value) => /** @type {Value} */ (['!', value]), /** @type {Value} */ (['ref', a]))
        identities(freeBindings(yielding(value)), [a])
    },
    lexicalResults: () => {
        const block = /** @type {Block} */ ({
            statements: [
                ['define', local, ['ref', a], 'lazy'],
                ['block', [result], yielding(['ref', local])],
                ['if', [innerResult], ['ref', b], yielding(['ref', result]), yielding(['ref', c])],
            ],
            exit: ['yield', [['array', [['ref', result], ['ref', innerResult]]]]],
        })
        identities(freeBindings(block), [a, b, c])
        identities(freeBindings({ statements: [], exit: ['throw', ['ref', b]] }), [b])
        identities(freeBindings(returning(['ref', c])), [c])
        identities(freeBindings({ statements: [], exit: ['continue', outer, [['ref', a]]] }), [a])
    },
    loopScopes: () => {
        const nested = /** @type {Loop} */ ({
            target: inner, parameters: [innerState], initial: [['ref', state]], results: [innerResult],
            body: { statements: [], exit: ['break', inner, [['array', [['ref', innerState], ['ref', c], ['ref', state]]]]] },
        })
        const loop = /** @type {Loop} */ ({
            target: outer, parameters: [state], initial: [['ref', a]], results: [result],
            body: { statements: [['define', local, ['ref', b], 'required'], ['loop', nested]], exit: ['break', outer, [['array', [['ref', local], ['ref', innerResult]]]]] },
        })
        identities(freeBindings({ statements: [['loop', loop]], exit: ['yield', [['ref', result]]] }), [a, b, c])
        identities(freeLoopBindings(loop), [b, c])
        identities(freeLoopBindings(nested), [c, state])
    },
}
