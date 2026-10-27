/**
 * Host time limits distinguish required failures from postponed infinite work.
 * @import { Block, Loop, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 */

import { throws } from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { assertEq, assertOk } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { toFast } from '../to_fast/module.f.mjs'
import { prepare } from '../../js/ast/prepare/module.f.mjs'
import { stringify } from '../../js/ast/serializer/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _body as body, _counting as counting } from './proof.f.mjs'

/** @type {() => Loop} */
const forever = () => {
    const state = id(0), output = id(0)
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target, parameters: [state], initial: [0], results: [output],
        body: body(['continue', target, [ref(state)]], [
            ['if', [], true, body(['continue', target, [['+', ref(state), 1]]]), body(['break', target, [ref(state)]])],
        ]),
    }
}

/** @type {(graph: Exp) => unknown} */
const execute = graph => runInNewContext(`(${stringify(prepare(assertOk(toFast(graph))), 'expression', true)})`, {}, { timeout: 100 })

/** @type {(block: Block, expected: 'TypeError' | 'timeout') => void} */
const orderedFailure = (block, expected) => throws(() => execute(fromFast(block)), expected === 'timeout'
    ? { code: 'ERR_SCRIPT_EXECUTION_TIMEOUT' } : { name: expected })

export const proof = /** @type {const} */ ({
    requiredInitializerPrecedesInfiniteLoop: () => {
        for (const used of [false, true]) {
            const failed = id(0), loop = forever()
            orderedFailure(result(used ? ref(failed) : 7, [
                ['define', failed, ['.', null, 'x'], 'required'], ['loop', loop],
            ]), 'TypeError')
        }
        const external = id(0), failed = id(0), loop = forever()
        throws(() => execute(fromFast(result(ref(failed), [
            ['define', failed, ref(external), 'required'], ['loop', loop],
        ]), [[external, ['.', null, 'x']]])), { name: 'TypeError' })
    },
    thrownPayloadRetainsInitializationOrder: () => {
        const first = id(0), second = id(0)
        const definitions = /** @type {readonly Statement[]} */ ([
            ['define', first, ['block', { statements: [], exit: ['throw', 1] }], 'required'],
            ['define', second, ['block', { statements: [], exit: ['throw', 2] }], 'required'],
        ])
        for (const before of [false, true]) {
            const loop = counting(0, 0)
            const graph = fromFast(result(['array', [ref(second), ref(first)]], before
                ? [['loop', loop], ...definitions] : [...definitions, ['loop', loop]]))
            throws(() => execute(graph), error => error === 1)
        }
        const graph = fromFast(result(['array', [ref(second), ref(first)]], [
            ['define', first, ['.', null, 'x'], 'required'], definitions[1],
        ]))
        throws(() => execute(graph), { name: 'TypeError' })
    },
    earlierLoopPrecedesLaterFailure: () => {
        for (const expansion of ['array', 'call']) {
            const loop = forever(), later = id(0)
            const values = /** @type {const} */ ([['...', null], ref(loop.results[0])])
            const value = /** @type {Value} */ (expansion === 'array' ? ['array', values] : ['()', null, values])
            orderedFailure(result(ref(later), [['loop', loop], ['define', later, value, 'required']]), 'timeout')
        }
        const loop = forever(), failed = id(0)
        orderedFailure(result(['array', [ref(failed), ref(loop.results[0])]], [
            ['loop', loop], ['define', failed, ['.', null, 'x'], 'required'],
        ]), 'timeout')
        const lazy = id(0), alias = id(0)
        orderedFailure(result(ref(alias), [
            ['loop', loop], ['define', lazy, ['array', [['...', null], ref(loop.results[0])]], 'lazy'],
            ['define', alias, ref(lazy), 'required'],
        ]), 'timeout')
    },
    coercionCannotPostponeEarlierFailure: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const callback = /** @type {Value} */ (['function', {
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 0], [['loop', forever()]]),
        }])
        for (const value of /** @type {readonly Value[]} */ ([
            ['Number', ['object', [[':', 'valueOf', callback]]]],
            ['String', ['object', [[':', 'toString', callback]]]],
            ['object', [[':', ['String', ['object', [[':', 'toString', callback]]]], 0]]],
        ])) {
            const failed = id(0), later = id(0)
            orderedFailure(result(['array', [ref(later), ref(failed)]], [
                ['define', failed, ['.', null, 'x'], 'required'], ['define', later, value, 'required'],
            ]), 'TypeError')
        }
    },
    conditionalDependencyRetainsEarlierFailure: () => {
        const failed = id(0), diverging = id(0), selected = id(0), loop = forever()
        orderedFailure(result(['array', [ref(selected), ref(failed), ref(diverging)]], [
            ['define', failed, ['.', null, 'x'], 'required'],
            ['define', diverging, ['block', result(ref(loop.results[0]), [['loop', loop]])], 'required'],
            ['define', selected, ['if', true, result(ref(diverging)), result(0)], 'required'],
        ]), 'TypeError')
    },
    retainedAnchorsPreserveEarlierFailure: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const call = /** @type {Value} */ (['()', ['function', {
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 0], [['loop', forever()]]),
        }], []])
        for (const extra of [false, true]) {
            const failed = id(0), diverging = id(0), other = id(0)
            orderedFailure(result(['array', extra ? [ref(other), ref(failed), ref(diverging)] : [ref(failed), call, ref(diverging)]], [
                ['define', failed, ['.', null, 'x'], 'required'], ['define', diverging, call, 'required'],
                ...(extra ? [/** @type {const} */ (['define', other, call, 'required'])] : []),
            ]), 'TypeError')
        }
        const diverging = id(0), failed = id(0), other = id(0), inner = id(0)
        orderedFailure(result(['array', [ref(diverging), ref(failed), ref(other)]], [
            ['define', diverging, call, 'required'], ['define', failed, ['.', null, 'x'], 'required'],
            ['define', other, ['block', result(0, [['define', inner, ['.', null, 'x'], 'required']])], 'required'],
        ]), 'timeout')
    },
    functionCaptureReadsAreEstablished: () => {
        const left = id(0), right = id(0), x = id(0), y = id(0)
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = /** @type {Value} */ (['function', {
            target, parameters: [], rest: null, self: null,
            captures: [{ binding: left, value: ref(left) }, { binding: right, value: ref(right) }],
            body: body(['return', target, ['array', [ref(x), ref(y)]]], [
                ['define', x, ref(left), 'required'], ['define', y, ref(right), 'required'],
            ]),
        }])
        const value = /** @type {readonly unknown[]} */ (execute(fromFast(result(['()', fn, []]), [[left, ['[]', []]], [right, ['[]', []]]])))
        assertEq(value.length, 2)
        assertEq(/** @type {readonly unknown[]} */ (value[0]).length, 0)
        assertEq(/** @type {readonly unknown[]} */ (value[1]).length, 0)
    },
})
