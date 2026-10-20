/**
 * Execute generated function text at the JavaScript boundary. These proofs
 * check the syntax and evaluation order that string comparisons cannot prove;
 * the interpreter itself never compiles or executes this text.
 * @import { Exp, Function as FunctionExp } from '../../../edag/types.ts'
 */

import { throws } from 'node:assert/strict'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
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
            [['String', 4n], '4'], [['Number', '5'], 5],
            [[',', []], undefined], [[',', [2]], 2], [[',', [1, 2]], 2],
            [['[]', [['...', 'ab'], [',', [1, 2]]]], ['a', 'b', 2]],
            [['.', ['[]', [8]], ['Number', '0']], 8],
            [['()', ['entry'], [['{}', [[':', 'x', 3]]], 'x']], 3],
            [['()', ['entry'], [['{}', [[':', 'u', ['undefined']]]], 'u']], undefined],
            [['()', ['entry'], [['{}', []], 'toString']], undefined],
            [['()', ['entry'], [['[]', [7]], 0]], 7],
            [['()', ['entry'], [['[]', [7]], 'length']], undefined],
            [['()', ['hasEntry'], [['{}', [[':', 'u', ['undefined']]]], 'u']], true],
            [['()', ['hasEntry'], [['[]', [7]], 'length']], false],
            [['.', ['entry'], 'length'], 2],
            [['()', ['Object.is'], [0, -0]], false], [['()', ['Object.is'], [NaN, NaN]], true],
            [['()', ['Number.isInteger'], [1.5]], false], [['()', ['Number.isSafeInteger'], [2 ** 53]], false],
            [['()', ['Number.isNaN'], ['NaN']], false], [['()', ['Number.isFinite'], [1]], true],
        ]
        for (const [body, expected] of cases) { assertStructurallySame(run(body), expected) }
        const object = /** @type {Record<string, unknown>} */ (run(['{}', [
            [':', '__proto__', 4], [':', ['+', 'k', 1], 5], ['...', ['{}', [[':', 'x', 6]]]],
        ]]))
        assertEq(Object.getOwnPropertyDescriptor(object, '__proto__')?.value, 4)
        assertEq(object.k1, 5)
        assertEq(object.x, 6)
        throws(() => run(['()', ['entry'], [null, 'x']]))
    },
    // a million rounds, which the named function expression a self-call is
    // otherwise spelled as could not run on V8, which implements no tail
    // calls
    loops: () => {
        /** @type {(next: Exp) => Exp} */
        const call = next => ['()', ['self'], [next]]
        assertEq(compile(['=>', 1, [], ['?:', ['<', ['arg', 0], 1_000_000], call(['+', ['arg', 0], 1]), ['arg', 0]]])(0), 1_000_000)
        // a function reading its rest array keeps the recursion, which gives
        // each round the empty array a call of one argument leaves
        const sum = compile(['=>', 1, [], ['?:', ['.', ['rest'], 'length'], call(['+', ['arg', 0], ['.', ['rest'], 0]]), ['arg', 0]]])
        assertEq(sum(1, 2, 3), 3)
        assertEq(sum(1), 1)
        // each round shares its own node and starts fresh
        const shared = /** @type {const} */ (['[]', [['arg', 0]]])
        assertEq(compile(['=>', 1, [], ['?:', ['<', ['arg', 0], 3], call(['+', ['.', shared, 0], ['.', shared, 'length']]), ['arg', 0]]])(0), 3)
        // and so does the recursion a condition reaching the shared node keeps
        const pairs = compile(['=>', 1, [], ['?:', ['<', ['.', shared, 0], 2], call(['+', ['.', shared, 0], 1]), ['[]', [shared, shared]]]])
        const result = pairs(0)
        assertEq(result[0], result[1])
        assertStructurallySame(result, [[2], [2]])
        // an assert that fails stops the loop at its round
        const failing = compile(['=>', 1, [], ['?:', ['<', ['arg', 0], 5], [',', [['?:', ['===', ['arg', 0], 3], ['throw', 'three'], 0], call(['+', ['arg', 0], 1])]], ['arg', 0]]])
        assertEq(failing(4), 5)
        throws(() => failing(0), e => e === 'three')
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
        // Deferred with the other native-host assertions in
        // ../../../../todo/blocked/bun-optional-chain-parentheses.md:
        // JavaScriptCore incorrectly skips this escaping call and its argument.
        // throws(() => run(['?.', null, 'x', ['|!()', [failure]]]), e => e === 'evaluated')
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
