/**
 * Execute generated function text at the JavaScript boundary. These proofs
 * check the syntax and evaluation order that string comparisons cannot prove;
 * the interpreter itself never compiles or executes this text.
 * @import { Exp, Function as FunctionExp } from '../../../edag/types.ts'
 */

import { throws } from 'node:assert/strict'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { tryFunctionText } from '../module.f.mjs'

/** @type {(e: FunctionExp, captures?: readonly unknown[]) => (...args: readonly unknown[]) => any} */
const compile = (e, captures = []) => Function(
    ...captures.map((_, i) => `$${i}`),
    `"use strict";return (${assertOk(tryFunctionText(e))});`,
)(...captures)

/** @type {(body: Exp) => unknown} */
const run = body => compile(['=>', 0, [], body])()

export const proof = {
    expressions: () => {
        /** @type {readonly (readonly [Exp, unknown])[]} */
        const cases = [
            [['!', 0], true], [['+', '3'], 3], [['typeof', ['[]', []]], 'object'],
            [['String', 4n], '4'], [['Number', '5'], 5], [['is', 0, -0], false],
            [[',', []], undefined], [[',', [2]], 2], [[',', [1, 2]], 2],
            [['[]', [['...', 'ab'], [',', [1, 2]]]], ['a', 'b', 2]],
            [['.', ['[]', [8]], ['Number', '0']], 8],
            [['own', ['{}', [[':', 'x', 3]]], 'x'], 3],
            [['own', ['{}', []], 'toString'], undefined],
        ]
        for (const [body, expected] of cases) { assertStructurallySame(run(body), expected) }
        const object = /** @type {Record<string, unknown>} */ (run(['{}', [
            [':', '__proto__', 4], [':', ['+', 'k', 1], 5], ['...', ['{}', [[':', 'x', 6]]]],
        ]]))
        assertEq(Object.getOwnPropertyDescriptor(object, '__proto__')?.value, 4)
        assertEq(object.k1, 5)
        assertEq(object.x, 6)
        throws(() => run(['own', ['{}', []], 1]), e => e === undefined)
        throws(() => run(['own', null, 'x']))
    },
    captures: () => {
        const captured = Object.freeze([9])
        /** @type {FunctionExp} */
        const outer = ['=>', 1, [['[]', [9]]], ['=>', 1,
            [['frame', 0], ['frame', 0], ['arg', 0], 7],
            ['[]', [['frame', 0], ['frame', 1], ['frame', 2], ['frame', 3], ['arg', 0], ['rest']]],
        ]]
        const make = compile(outer, [captured])
        const inner = make(10)
        assertEq(make.length, 1)
        assertEq(inner.length, 1)
        const result = inner(11, 12, 13)
        assertEq(result[0], captured)
        assertEq(result[1], captured)
        assertStructurallySame(result.slice(2), [10, 7, 11, [12, 13]])
        assertEq(inner()[0], captured)
        throws(() => run(['=>', 0, [['throw', 'unused capture']], 1]), e => e === 'unused capture')
    },
    sharedLazyValues: () => {
        const shared = /** @type {const} */ (['[]', []])
        /** @type {FunctionExp} */
        const graph = ['=>', 2, [], ['[]', [
            ['&&', ['arg', 0], shared], ['||', ['arg', 1], shared],
        ]]]
        const fn = compile(graph)
        const first = fn(true, false)
        const next = fn(true, false)
        assertEq(first[0], first[1])
        assertEq(next[0], next[1])
        assert(first[0] !== next[0])
        assertStructurallySame(fn(false, true), [false, true])
        const failure = /** @type {const} */ (['throw', 'demanded'])
        const lazy = compile(['=>', 2, [], ['[]', [
            ['&&', ['arg', 0], failure], ['||', ['arg', 1], failure],
        ]]])
        assertStructurallySame(lazy(false, true), [false, true])
        throws(() => lazy(true, true), e => e === 'demanded')
        throws(() => lazy(false, false), e => e === 'demanded')
    },
    optionalRegions: () => {
        const failure = /** @type {const} */ (['throw', 'evaluated'])
        assertEq(run(['?.', null, ['Number', failure], ['|.', 'x', ['|()', [failure]]]]), undefined)
        assertEq(run(['?.()', null, [failure], ['|.', 'x']]), undefined)
        assertEq(run(['.', ['{}', []], 'x', ['|?.()', [failure], ['|.', 'y']]]), undefined)
        // Parentheses end the optional region: the argument runs before the
        // escaping call can fail because its callee is undefined.
        throws(() => run(['?.', null, 'x', ['|!()', [failure]]]), e => e === 'evaluated')
        assertEq(run(['?.', ' ab ', 'trim', ['|!()', []]]), 'ab')
        assertEq(run(['?.', ' a,b ', 'trim', ['|()', [], ['|.', 'split', ['|()', [','], ['|.', 1]]]]]), 'b')
        assertEq(run(['.', ' a ', 'trim', ['|?.()', []]]), 'a')
    },
    bareAndReceiverCalls: () => {
        /** @type {FunctionExp} */
        const bare = ['=>', 1, [], ['()', ['.', ['arg', 0], 'method'], []]]
        /** @type {FunctionExp} */
        const optional = ['=>', 1, [], ['?.()', ['.', ['arg', 0], 'method'], []]]
        /** @type {FunctionExp} */
        const receiver = ['=>', 1, [], ['.', ['arg', 0], 'method', ['|?.()', []]]]
        const object = { method() { return this } }
        assertEq(compile(bare)(object), undefined)
        assertEq(compile(optional)(object), undefined)
        assertEq(compile(receiver)(object), object)
    },
}
