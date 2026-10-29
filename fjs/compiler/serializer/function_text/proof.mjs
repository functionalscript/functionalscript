/**
 * Execute generated function text at the JavaScript boundary. These proofs
 * check the syntax and evaluation order that string comparisons cannot prove;
 * the interpreter itself never compiles or executes this text.
 * @import { Exp, Function as FunctionExp } from '../../../edag/types.ts'
 */

import { conditional } from '../../../edag/testlib.f.js'
import { throws } from 'node:assert/strict'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { tryFunctionText, tryStringify } from '../module.f.mjs'
import { parse } from '../../transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'

/** @type {(e: FunctionExp, captures?: readonly unknown[]) => (...args: readonly unknown[]) => any} */
const compile = (e, captures = []) => Function(
    ...captures.map((_, i) => `$${i}`),
    `"use strict";return (${assertOk(tryFunctionText(e))});`,
)(...captures)

/** @type {(body: Exp) => unknown} */
const run = body => compile(['=>', 0, [], body])()

export const proof = {
    forLoopTransfersUseWhile: async () => {
        const source = 'export default (test,body,step)=>{for(let i=0;test(i);i=step(i)){if(i===1){continue;}if(i===3){break;}body(i);}return 9;};'
        const graph = _defaultExport(unresolved(assertOk(parse('/for-transfers.f.js')(source))).edag)
        assert(graph instanceof Array && graph[0] === '=>')
        const text = assertOk(tryStringify(graph))
        const functionText = assertOk(tryFunctionText(graph))
        for (const output of [text, functionText]) {
            assert(output.includes('while('), output)
            assert(!output.includes('for('), output)
        }
        const module = await import(`data:text/javascript,${encodeURIComponent(text)}`)
        for (const fn of [module.default, compile(graph)]) {
            /** @type {readonly string[]} */
            let trace = []
            /** @type {(i: number) => boolean} */
            const test = i => { trace = [...trace, `test ${i}`]; return i < 5 }
            /** @type {(i: number) => number} */
            const body = i => { trace = [...trace, `body ${i}`]; return i }
            /** @type {(i: number) => number} */
            const step = i => { trace = [...trace, `step ${i}`]; return i + 1 }
            assertEq(fn(test, body, step), 9)
            assertStructurallySame(trace, ['test 0', 'body 0', 'step 0', 'test 1', 'step 1', 'test 2', 'body 2', 'step 2', 'test 3'])
            trace = []
            assertEq(fn(() => false, body, step), 9)
            assertStructurallySame(trace, [])
            throws(() => fn(test, () => { throw 'body failure' }, step), e => e === 'body failure')
            assertStructurallySame(trace, ['test 0'])
            trace = []
            throws(() => fn(test, body, () => { throw 'step failure' }), e => e === 'step failure')
            assertStructurallySame(trace, ['test 0', 'body 0'])
        }
    },
    forLoopBytePackingUsesWhile: async () => {
        const source = 'export default (input,first,count)=>{let word=0;for(let i=0;i<count;i+=1){word|=input[Number(first+i)]<<8*i;}return word;};'
        const graph = _defaultExport(unresolved(assertOk(parse('/for-byte-packing.f.js')(source))).edag)
        assert(graph instanceof Array && graph[0] === '=>')
        const text = assertOk(tryStringify(graph))
        assert(text.includes('while('), text)
        assert(!text.includes('for('), text)
        const module = await import(`data:text/javascript,${encodeURIComponent(text)}`)
        for (const fn of [module.default, compile(graph)]) {
            assertEq(fn([0xff, 0x12, 0x34, 0x56], 1, 3), 0x56_3412)
            assertEq(fn([0x12, 0x34], 0, 0), 0)
        }
    },
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
        // A function reading rest gets the current invocation's array,
        // including the empty array a one-argument transition leaves.
        const sum = compile(['=>', 1, [], ['?:', ['.', ['rest'], 'length'], call(['+', ['arg', 0], ['.', ['rest'], 0]]), ['arg', 0]]])
        assertEq(sum(1, 2, 3), 3)
        assertEq(sum(1), 1)
        // each round shares its own node and starts fresh
        const shared = /** @type {const} */ (['[]', [['arg', 0]]])
        assertEq(compile(['=>', 1, [], ['?:', ['<', ['arg', 0], 3], call(['+', ['.', shared, 0], ['.', shared, 'length']]), ['arg', 0]]])(0), 3)
        // A condition and arm sharing identity establish one value each round.
        const pairs = compile(['=>', 1, [], ['?:', ['<', ['.', shared, 0], 2], call(['+', ['.', shared, 0], 1]), ['[]', [shared, shared]]]])
        const result = pairs(0)
        assertEq(result[0], result[1])
        assertStructurallySame(result, [[2], [2]])
        // an assert that fails stops the loop at its round
        const failing = compile(['=>', 1, [], ['?:', ['<', ['arg', 0], 5], [',', [['?:', ['===', ['arg', 0], 3], ['throw', 'three'], 0], call(['+', ['arg', 0], 1])]], ['arg', 0]]])
        assertEq(failing(4), 5)
        throws(() => failing(0), e => e === 'three')
    },
    tailArgumentCounts: () => {
        const missing = compile(['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1]]], ['arg', 1]]])
        assertEq(missing.length, 2)
        assertEq(missing(100_000, 9), undefined)
        assertEq(missing(0, 9), 9)
        const swapped = compile(['=>', 3, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['arg', 2], ['arg', 1], ['[]', [['arg', 0]]]]],
            ['[]', [['arg', 1], ['arg', 2]]]]])
        assertEq(swapped.length, 3)
        assertStructurallySame(swapped(100_001, 1, 2), [2, 1])
        const captured = compile(['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['=>', 0, [['arg', 0]], ['frame', 0]], 7]], ['arg', 1]]])
        assertEq(captured(100_000, null)(), 1)
        const failing = compile(['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['throw', 'unused extra']]], ['arg', 0]]])
        assertEq(failing(0), 0)
        throws(() => failing(1), e => e === 'unused extra')
    },
    spreadTailArguments: () => {
        const count = compile(['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['...', ['[]', [['-', ['arg', 0], 1], ['+', ['arg', 1], 1]]]]]], ['arg', 1]]])
        assertEq(count.length, 2)
        assertEq(count(100_000, 0), 100_000)
        const swapped = compile(['=>', 3, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['...', ['[]', [['arg', 2]]]], ['...', ['[]', []]], ['arg', 1]]],
            ['[]', [['arg', 1], ['arg', 2]]]]])
        assertStructurallySame(swapped(100_001, 1, 2), [2, 1])
        const captured = compile(['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['...', ['[]', [['-', ['arg', 0], 1], ['=>', 0, [['arg', 0]], ['frame', 0]]]]]]], ['arg', 1]]])
        assertEq(captured(100_000, null)(), 1)
        const missing = compile(['=>', 2, [], ['?:', ['===', ['arg', 0], ['undefined']], ['arg', 1],
            ['()', ['self'], [['...', ['[]', []]]]]]])
        assertEq(missing(1, 9), undefined)
        const text = compile(['=>', 3, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [0, ['...', 'A𝄞'], 99]], ['[]', [['arg', 1], ['arg', 2]]]]])
        assertStructurallySame(text(1), ['A', '𝄞'])
        const invalid = compile(['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [0, ['...', null]]], 7]])
        assertEq(invalid(0), 7)
        throws(() => invalid(1))
        const extra = compile(['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['...', ['[]', [0, ['throw', 'expanded extra']]]]]], 7]])
        assertEq(extra(0), 7)
        throws(() => extra(1), e => e === 'expanded extra')
    },
    restTailInvocations: () => {
        const rest = /** @type {Exp} */ (['rest'])
        const fresh = compile(['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], rest, ['...', rest]]],
            ['[]', [['===', ['arg', 1], rest], ['===', rest, rest], rest]]]])
        assertEq(fresh.length, 2)
        assertStructurallySame(fresh(100_000, null, 7, 8), [false, true, [7, 8]])
        const snapshot = compile(['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['=>', 0, [rest], ['frame', 0]], ['arg', 0]]], ['arg', 1]]])
        assertStructurallySame(snapshot(100_000, null, 9)(), [2])
        const n = /** @type {Exp} */ (['.', rest, 0])
        const count = compile(['=>', 0, [], ['?:', ['>', n, 0],
            ['()', ['self'], [['-', n, 1], ['+', ['.', rest, 1], 1]]], rest]])
        assertEq(count.length, 0)
        assertStructurallySame(count(100_000, 0), [0, 100_000])
    },
    defaultAndDestructuringTailSetup: () => {
        /** @type {(source: string) => (...args: readonly unknown[]) => any} */
        const fromSource = source => {
            const fn = _defaultExport(unresolved(assertOk(parse('/defaults.f.js')(source))).edag)
            assert(fn instanceof Array && fn[0] === '=>')
            return compile(fn)
        }
        const fresh = fromSource('const f=(n,prev,value=[])=>n===0?[prev===value,value===value]:f(n-1,value);export default f;')
        assertEq(fresh.length, 2)
        assertStructurallySame(fresh(100_000, null), [false, true])
        const destructured = fromSource('const f=(n,{value}={value:0})=>n===0?value:f(n-1,{value:value+1});export default f;')
        assertEq(destructured.length, 1)
        assertEq(destructured(100_000), 100_000)
        const failing = fromSource('const f=(n,value=null.x)=>n===0?7:f(n-1);export default f;')
        assertEq(failing(0, 9), 7)
        throws(() => failing(1, 9))
        throws(() => failing(0))
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
            conditional('&&', ['arg', 0], shared), conditional('||', ['arg', 1], shared),
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
            conditional('&&', ['arg', 0], failure), conditional('||', ['arg', 1], failure),
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
