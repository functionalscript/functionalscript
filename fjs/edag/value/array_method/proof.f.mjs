/**
 * @import { Exp } from '../../types.ts'
 * @import { EdagValue, Values, Function as ValueFunction } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { error } from '../../../types/result/module.f.mjs'
import { invoke } from '../../memo/module.f.mjs'
import { toData } from '../to_unknown/module.f.mjs'
import { arrayMethod } from './module.f.mjs'

/** Literal fixtures are already evaluated, closed functions. @type {(length: number, body: Exp) => ValueFunction} */
const fn = (length, body) => ['=>', length, [], body]

const identity = fn(1, ['arg', 0])
const positive = fn(1, ['>', ['arg', 0], 0])
const sum = fn(2, ['+', ['arg', 0], ['arg', 1]])
const difference = fn(2, ['-', ['arg', 0], ['arg', 1]])
const fail = fn(0, ['throw', 'callback failed'])
const undefinedValue = /** @type {const} */ (['undefined'])
const badConversion = /** @type {const} */ (['{}', [[':', 'valueOf', fail], [':', 'toString', fail]]])

/** @type {(values: Values, key: string, args?: Values) => EdagValue} */
const run = (values, key, args = []) => assertOk(arrayMethod(['[]', values], key, args, invoke))

/** @type {(values: Values, key: string, args: Values, expected: unknown) => void} */
const data = (values, key, args, expected) => assertStructurallySame(assertOk(toData(run(values, key, args))), expected)

export const proof = {
    copies: () => {
        const child = /** @type {const} */ (['{}', []])
        const receiver = /** @type {const} */ (['[]', [child, 2, 3]])
        const reversed = assertOk(arrayMethod(receiver, 'toReversed', [], invoke))
        assert(reversed instanceof Array && reversed[0] === '[]')
        assert(reversed !== receiver)
        assertEq(reversed[1][2], child)
        data([1], 'concat', [['[]', [2]], 'ab', ['{}', []], undefinedValue], [1,2,'ab',{},undefined])
        data([], 'concat', [], [])
        data(receiver[1], 'slice', [], [{},2,3])
        data([1,2,3], 'slice', [-2, -1], [2])
        data([1,2,3], 'with', [-1, child], [1,2,{}])
        data([1,2], 'with', [], [undefined,2])
        data([1,2], 'with', [0.9, 3], [3,2])
        assertEq(run([child], 'at', []), child)
        assertStructurallySame(run([], 'at', [Infinity]), undefinedValue)
        data([1,2,3], 'toSpliced', [], [1,2,3])
        data([1,2,3], 'toSpliced', [1], [1])
        data([1,2,3], 'toSpliced', [-2, 1, child, 4], [1,{},4,3])
        data([1,2], 'toSpliced', [Infinity, 5, 3], [1,2,3])
        data([1,2], 'toSpliced', [-Infinity, -1, 3], [3,1,2])
        data([1,2], 'toSpliced', [1, undefinedValue, 3], [1,3,2])
    },
    numericFailures: () => {
        for (const key of ['at', 'slice', 'with', 'toSpliced', 'flat']) {
            assertStructurallySame(assertError(arrayMethod(['[]', []], key, [1n], invoke)), undefinedValue)
            assertEq(assertError(arrayMethod(['[]', []], key, [badConversion], invoke)), 'callback failed')
        }
        for (const key of ['slice', 'toSpliced']) {
            assertStructurallySame(assertError(arrayMethod(['[]', []], key, [0, 1n], invoke)), undefinedValue)
        }
        for (const index of [-3, 2, Infinity, -Infinity]) {
            assertStructurallySame(assertError(arrayMethod(['[]', [1,2]], 'with', [index, 0], invoke)), undefinedValue)
        }
        // Only original undefined defaults an end; conversion to undefined
        // takes the ordinary numeric path and produces zero.
        const convertedUndefined = /** @type {const} */ (['{}', [[':', 'valueOf', fn(0, ['undefined'])]]])
        data([1,2], 'slice', [0, convertedUndefined], [])
        data([1,2], 'slice', [0, undefinedValue], [1,2])
    },
    flattened: () => {
        const nested = /** @type {const} */ (['[]', [2, ['[]', [3]]]])
        data([1,nested], 'flat', [], [1,2,[3]])
        data([1,nested], 'flat', [Infinity], [1,2,3])
        data([1,nested], 'flat', [0], [1,[2,[3]]])
        data([1,nested], 'flat', [NaN], [1,[2,[3]]])
        data([1,nested], 'flat', [-1], [1,[2,[3]]])
        const pair = fn(1, ['[]', [['arg', 0], ['[]', [['arg', 0]]]]])
        data([1,2], 'flatMap', [pair], [1,[1],2,[2]])
        data([1,2], 'flatMap', [identity], [1,2])
    },
    joined: () => {
        data([1,null,undefinedValue,['[]',[2,3]]], 'join', [], '1,,,2,3')
        data([1,2], 'join', ['-'], '1-2')
        data([1,2], 'toString', [badConversion], '1,2')
        data([], 'join', [null], '')
        assertEq(assertError(arrayMethod(['[]', []], 'join', [badConversion], invoke)), 'callback failed')
        assertEq(assertError(arrayMethod(['[]', [badConversion]], 'join', [], invoke)), 'callback failed')
    },
    searching: () => {
        const child = /** @type {const} */ (['{}', []])
        assertEq(run([child], 'indexOf', [child]), 0)
        assertEq(run([child], 'indexOf', [['{}', []]]), -1)
        assertEq(run([NaN, -0, undefinedValue], 'includes', [NaN]), true)
        assertEq(run([NaN, -0, undefinedValue], 'includes', [0]), true)
        assertEq(run([NaN, -0, undefinedValue], 'includes', []), true)
        assertEq(run([NaN], 'indexOf', [NaN]), -1)
        assertEq(run([1,2,1], 'indexOf', [1, 1]), 2)
        assertEq(run([1,2,1], 'indexOf', [1, -1]), 2)
        assertEq(run([1,2,1], 'indexOf', [1, Infinity]), -1)
        assertEq(run([1,2,1], 'lastIndexOf', [1]), 2)
        assertEq(run([1,2,1], 'lastIndexOf', [1, undefinedValue]), 0)
        assertEq(run([1,2,1], 'lastIndexOf', [1, -2]), 0)
        assertEq(run([1,2,1], 'lastIndexOf', [1, -4]), -1)
        assertEq(run([1,2,1], 'lastIndexOf', [1, Infinity]), 2)
        assertEq(run([1,2,1], 'lastIndexOf', [3, Infinity]), -1)
        for (const key of ['includes', 'indexOf', 'lastIndexOf']) {
            assertEq(run([], key, [0, 1n]), key === 'includes' ? false : -1)
            assertStructurallySame(assertError(arrayMethod(['[]', [0]], key, [0, 1n], invoke)), undefinedValue)
        }
        assertEq(run([1], 'includes', [2]), false)
    },
    predicates: () => {
        data([-1,2,0,3], 'filter', [positive], [2,3])
        assertEq(run([-1,2], 'every', [positive]), false)
        assertEq(run([1,2], 'every', [positive]), true)
        assertEq(run([], 'every', [positive]), true)
        assertEq(run([-1,2], 'some', [positive]), true)
        assertEq(run([-1,0], 'some', [positive]), false)
        assertEq(run([-1,2,3], 'find', [positive]), 2)
        assertEq(run([-1,2,3], 'findIndex', [positive]), 1)
        assertEq(run([-1,2,3], 'findLast', [positive]), 3)
        assertEq(run([1,2,0], 'findLastIndex', [positive]), 1)
        for (const key of ['find', 'findLast']) { assertStructurallySame(run([0], key, [positive]), undefinedValue) }
        for (const key of ['findIndex', 'findLastIndex']) { assertEq(run([0], key, [positive]), -1) }
        const callback = fn(3, ['[]', [['arg', 0], ['arg', 1], ['arg', 2]]])
        data([4,5], 'map', [callback], [[4,0,[4,5]],[5,1,[4,5]]])
        const receiver = /** @type {const} */ (['[]', [4,5]])
        const results = assertOk(arrayMethod(receiver, 'map', [fn(3, ['arg', 2])], invoke))
        assert(results instanceof Array && results[0] === '[]')
        assertEq(results[1][0], receiver)
        assertEq(results[1][1], receiver)
    },
    reductions: () => {
        assertEq(run([1,2,3], 'reduce', [sum]), 6)
        assertEq(run([1,2,3], 'reduce', [sum, 4]), 10)
        assertEq(run([1,2,3], 'reduceRight', [difference]), 0)
        assertEq(run([1,2,3], 'reduceRight', [difference, 10]), 4)
        assertEq(run([], 'reduce', [sum, 4]), 4)
        assertStructurallySame(run([], 'reduceRight', [sum, undefinedValue]), undefinedValue)
        assertEq(run([7], 'reduce', [sum]), 7)
        assertStructurallySame(assertError(arrayMethod(['[]', []], 'reduce', [sum], invoke)), undefinedValue)
        const callback = fn(4, ['[]', [['arg', 0], ['arg', 1], ['arg', 2], ['arg', 3]]])
        data([8], 'reduce', [callback, 2], [2,8,0,[8]])
    },
    callbackFailures: () => {
        for (const key of ['every','filter','find','findIndex','findLast','findLastIndex','flatMap','map','some','reduce','reduceRight']) {
            assertStructurallySame(assertError(arrayMethod(['[]', []], key, [null], invoke)), undefinedValue)
            assertStructurallySame(assertError(arrayMethod(['[]', []], key, [['{}', []]], invoke)), undefinedValue)
            assertEq(assertError(arrayMethod(['[]', [1,2]], key, [fail], invoke)), 'callback failed')
        }
        const failure = error(/** @type {const} */ (['{}', []]))
        assertEq(arrayMethod(['[]', [1]], 'map', [identity], () => failure), failure)
        assertEq(arrayMethod(['[]', [1]], 'reduce', [sum, 0], () => failure), failure)
        assertEq(arrayMethod(['[]', [2,1]], 'toSorted', [difference], () => failure), failure)
        assertStructurallySame(assertError(arrayMethod(['[]', []], 'missing', [], invoke)), undefinedValue)
    },
    sorted: () => {
        data([2,10,1], 'toSorted', [], [1,10,2])
        data([2,10,1], 'toSorted', [difference], [1,2,10])
        data([2,undefinedValue,1,undefinedValue], 'toSorted', [], [1,2,undefined,undefined])
        data([undefinedValue,2,1], 'toSorted', [difference], [1,2,undefined])
        data([1,1,2], 'toSorted', [], [1,1,2])
        data([2,1], 'toSorted', [fn(0, NaN)], [2,1])
        data([], 'toSorted', [difference], [])
        data([1], 'toSorted', [fail], [1])
        const first = /** @type {const} */ (['{}', [[':', 'key', 1], [':', 'name', 'a']]])
        const second = /** @type {const} */ (['{}', [[':', 'key', 1], [':', 'name', 'b']]])
        const byKey = fn(2, ['-', ['.', ['arg', 0], 'key'], ['.', ['arg', 1], 'key']])
        const ordered = run([first,second], 'toSorted', [byKey])
        assert(ordered instanceof Array && ordered[0] === '[]')
        assertEq(ordered[1][0], first)
        assertEq(ordered[1][1], second)
        for (const comparator of [null, 1, ['{}', []]]) {
            assertStructurallySame(assertError(arrayMethod(['[]', []], 'toSorted', [/** @type {EdagValue} */ (comparator)], invoke)), undefinedValue)
        }
        assertEq(assertError(arrayMethod(['[]', [1,2]], 'toSorted', [fail], invoke)), 'callback failed')
        assertStructurallySame(assertError(arrayMethod(['[]', [1,2]], 'toSorted', [fn(0, 1n)], invoke)), undefinedValue)
        assertEq(assertError(arrayMethod(['[]', [0,badConversion]], 'toSorted', [], invoke)), 'callback failed')
        assertEq(assertError(arrayMethod(['[]', [badConversion,0]], 'toSorted', [], invoke)), 'callback failed')
    },
}
