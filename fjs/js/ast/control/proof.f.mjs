/**
 * Helper inventories preserve lexical identities and order while respecting
 * ordinary function boundaries. Escape facts retain unreachable syntax and
 * distinguish normal loop exits from enclosing control transfers.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Value } from '../types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { exitValues, freeBindings, freeLoopBindings, hasLoopTransfer } from './module.f.mjs'

const a = /** @type {const} */ ({ index: 0 })
const b = /** @type {const} */ ({ index: 1 })
const c = /** @type {const} */ ({ index: 2 })
const local = /** @type {const} */ ({ index: 3 })
const result = /** @type {const} */ ({ index: 4 })
const state = /** @type {const} */ ({ index: 5 })
const innerState = /** @type {const} */ ({ index: 6 })
const innerResult = /** @type {const} */ ({ index: 7 })
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
    transferKindsKeepLoopOwnershipAndFunctionBoundaries: () => {
        assertEq(hasLoopTransfer.length, 2)
        const continued = /** @type {Block} */ ({ statements: [], exit: ['continue', outer, []] })
        const stopped = /** @type {Block} */ ({ statements: [], exit: ['break', outer, []] })
        assertEq(hasLoopTransfer(continued, outer, 'continue'), true)
        assertEq(hasLoopTransfer(continued, outer, 'break'), false)
        assertEq(hasLoopTransfer(stopped, outer, 'break'), true)
        assertEq(hasLoopTransfer(stopped, outer, 'continue'), false)
        const mixed = /** @type {Block} */ ({ statements: [['if', [], true, stopped, continued]], exit: ['yield', []] })
        assertEq(hasLoopTransfer(mixed, outer, 'continue'), true)
        assertEq(hasLoopTransfer(mixed, outer, 'break'), true)
        assertEq(hasLoopTransfer(mixed, inner, 'continue'), false)
        for (const value of /** @type {readonly (Value | Block)[]} */ ([
            ['block', continued], ['if', false, yielding(0), continued],
            fn([{ binding: local, value: ['block', continued] }], nestedReturning(0)),
            { statements: [['define', local, ['block', continued], 'lazy']], exit: ['yield', []] },
            { statements: [['loop', { target: inner, parameters: [], initial: [], results: [], body: continued }]], exit: ['yield', []] },
        ])) { assertEq(hasLoopTransfer(value, outer, 'continue'), true) }
        for (const value of /** @type {readonly (Value | Block)[]} */ ([
            fn([], nestedReturning(['block', continued])),
            { statements: [['loop', { target: inner, parameters: [], initial: [], results: [], body: { statements: [], exit: ['continue', inner, []] } }]], exit: ['yield', []] },
        ])) { assertEq(hasLoopTransfer(value, outer, 'continue'), false) }
    },
    terminalLoopsKeepTheirLexicalDependencies: () => {
        /** @type {Loop} */
        const loop = { target: outer, parameters: [state], initial: [['ref', a]], results: [], body: {
            statements: [['define', local, ['ref', state], 'required']],
            exit: ['continue', outer, [['array', [['ref', local], ['ref', b]]]]],
        } }
        /** @type {Block} */
        const terminal = { statements: [], exit: ['loop', loop] }
        assertEq(exitValues(terminal.exit), loop.initial)
        identities(freeBindings(terminal), [a, b])
        assertEq(hasLoopTransfer(terminal, outer), true)
        assertEq(hasLoopTransfer(terminal, inner), false)
        /** @type {Loop} */
        const captured = { ...loop, initial: [], body: returning(fn([], nestedReturning(['block', loop.body]))) }
        assertEq(hasLoopTransfer({ statements: [], exit: ['loop', captured] }, outer), false)
    },
    loopTransferOwners: () => {
        const escaping = /** @type {Block} */ ({ statements: [], exit: ['continue', outer, [['ref', a]]] })
        const stopped = /** @type {Block} */ ({ statements: [], exit: ['break', outer, []] })
        const returned = returning(['ref', a])
        const nested = /** @type {Loop} */ ({ target: inner, parameters: [], initial: [null], results: [], body: escaping })
        for (const value of /** @type {readonly (Value | Block)[]} */ ([
            escaping, stopped, ['block', escaping],
            ['if', false, yielding(1), escaping],
            fn([{ binding: local, value: ['block', escaping] }], nestedReturning(0)),
            { statements: [['define', local, ['block', escaping], 'required']], exit: ['yield', []] },
            { statements: [['block', [], escaping]], exit: ['yield', []] },
            { statements: [['if', [], true, yielding(1), escaping]], exit: ['yield', []] },
            { statements: [['loop', nested]], exit: ['yield', []] },
        ])) { assertEq(hasLoopTransfer(value, outer), true) }
        for (const value of /** @type {readonly (Value | Block)[]} */ ([
            null, undefined, ['ref', a], ['array', [1, ['ref', a]]], returned,
            fn([], nestedReturning(['block', escaping])),
            ['block', { statements: [], exit: ['break', inner, []] }],
            { statements: [['loop', { ...nested, initial: [], body: yielding(1) }]], exit: ['throw', 1] },
        ])) { assertEq(hasLoopTransfer(value, outer), false) }
    },
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
