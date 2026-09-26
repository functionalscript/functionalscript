/**
 * The member-function cases of the corpus: one group per `Array`, `String`
 * and `Number` method `nanvm-lib` answers, each case a receiver and its
 * arguments. [`../module.f.mjs`](../module.f.mjs) appends these groups to
 * its operator groups to form `data`; they are a module of their own only so
 * that no one source file outgrows what the repository's file reader accepts.
 *
 * @module
 *
 * @import { Expectation, MethodCase, MethodGroup } from '../types.ts'
 *
 * @example
 *
 * ```js
 * import { groups } from './module.f.mjs'
 *
 * groups.length // 44
 * ```
 */

import { callback, functionValue, throws } from '../constructors/module.f.mjs'

/**
 * `Array.prototype.at`: the element from the start or, for a negative index,
 * from the end, `undefined` out of range, and the index `ToIntegerOrInfinity`
 * of the argument — truncated, a string converted, `undefined` and `NaN`
 * zero, and a bigint the `TypeError` `ToNumber` throws.
 *
 * @type {readonly MethodCase[]}
 */
const atCases = [
    { name: 'first', args: [[10, 20, 30], 0], expected: 10 },
    { name: 'last', args: [[10, 20, 30], 2], expected: 30 },
    { name: 'fromTheEnd', args: [[10, 20, 30], -1], expected: 30 },
    { name: 'firstFromTheEnd', args: [[10, 20, 30], -3], expected: 10 },
    { name: 'pastTheEnd', args: [[10, 20, 30], 3], expected: undefined },
    { name: 'beforeTheStart', args: [[10, 20, 30], -4], expected: undefined },
    { name: 'infinity', args: [[10, 20, 30], Infinity], expected: undefined },
    { name: 'negativeInfinity', args: [[10, 20, 30], -Infinity], expected: undefined },
    { name: 'empty', args: [[], 0], expected: undefined },
    { name: 'truncated', args: [[10, 20, 30], 1.7], expected: 20 },
    { name: 'negativeFraction', args: [[10, 20, 30], -0.5], expected: 10 },
    { name: 'string', args: [[10, 20, 30], '1'], expected: 20 },
    { name: 'undefinedIndex', args: [[10, 20, 30], undefined], expected: 10 },
    { name: 'nanIndex', args: [[10, 20, 30], NaN], expected: 10 },
    { name: 'noArgument', args: [[10, 20, 30]], expected: 10 },
    { name: 'extraArgument', args: [[10, 20, 30], 1, 2], expected: 20 },
    { name: 'nested', args: [[[1], [2]], 1], expected: [2] },
    { name: 'bigint', args: [[10, 20, 30], 1n], expected: throws },
    { name: 'object', args: [{}, 0], expected: throws },
    { name: 'number', args: [1, 0], expected: throws },
    { name: 'ownProperty', args: [{ at: functionValue }, 0], expected: undefined },
    { name: 'stringFirst', args: ['abc', 0], expected: 'a' },
    { name: 'stringFromTheEnd', args: ['abc', -1], expected: 'c' },
    { name: 'stringPastTheEnd', args: ['abc', 3], expected: undefined },
    { name: 'stringBeforeTheStart', args: ['abc', -4], expected: undefined },
    { name: 'stringNoArgument', args: ['abc'], expected: 'a' },
    { name: 'stringEmpty', args: ['', 0], expected: undefined },
    { name: 'stringCodeUnit', args: ['\u{1F600}', 0], expected: '\uD83D' },
    { name: 'stringBigint', args: ['abc', 0n], expected: throws },
]

/**
 * `Array.prototype.includes`: `SameValueZero`, so `NaN` is found and `0`
 * finds `-0`, from a relative position clamped into the array. An empty
 * array answers before the position is converted, so a bigint position
 * throws only on a non-empty one.
 *
 * @type {readonly MethodCase[]}
 */
const includesCases = [
    { name: 'found', args: [[1, 2, 3], 2], expected: true },
    { name: 'notFound', args: [[1, 2, 3], 4], expected: false },
    { name: 'nan', args: [[1, NaN], NaN], expected: true },
    { name: 'negativeZero', args: [[0], -0], expected: true },
    { name: 'noCoercion', args: [[1], '1'], expected: false },
    { name: 'nullIsNotUndefined', args: [[null], undefined], expected: false },
    { name: 'noArgument', args: [[undefined]], expected: true },
    { name: 'empty', args: [[], undefined], expected: false },
    { name: 'from', args: [[1, 2, 3], 1, 1], expected: false },
    { name: 'fromTheEnd', args: [[1, 2, 3], 3, -1], expected: true },
    { name: 'fromBeforeTheStart', args: [[1, 2, 3], 1, -9], expected: true },
    { name: 'fromPastTheEnd', args: [[1, 2, 3], 3, 3], expected: false },
    { name: 'fromInfinity', args: [[1], 1, Infinity], expected: false },
    { name: 'fromString', args: [[1, 2], 1, '1'], expected: false },
    { name: 'emptyBigintFrom', args: [[], 1, 1n], expected: false },
    { name: 'bigintFrom', args: [[1], 1, 1n], expected: throws },
    { name: 'object', args: [{}, 1], expected: throws },
    { name: 'stringFound', args: ['abc', 'bc'], expected: true },
    { name: 'stringNotFound', args: ['abc', 'cb'], expected: false },
    { name: 'stringEmpty', args: ['abc', ''], expected: true },
    { name: 'stringFrom', args: ['abc', 'a', 1], expected: false },
    { name: 'stringFromNegative', args: ['abc', 'a', -5], expected: true },
    { name: 'stringNoArgument', args: ['undefined'], expected: true },
    { name: 'stringNumber', args: ['a1b', 1], expected: true },
    { name: 'stringObject', args: ['[object Object]', {}], expected: true },
    { name: 'stringBigintFrom', args: ['abc', 'a', 0n], expected: throws },
]

/**
 * `Array.prototype.indexOf`: strict equality, so `NaN` is never found, from
 * the same clamped position as `includes`.
 *
 * @type {readonly MethodCase[]}
 */
const indexOfCases = [
    { name: 'first', args: [[1, 2, 1], 1], expected: 0 },
    { name: 'notFound', args: [[1, 2, 3], 4], expected: -1 },
    { name: 'nan', args: [[NaN], NaN], expected: -1 },
    { name: 'negativeZero', args: [[1, 0], -0], expected: 1 },
    { name: 'noCoercion', args: [[1], '1'], expected: -1 },
    { name: 'noArgument', args: [[1, undefined]], expected: 1 },
    { name: 'empty', args: [[], undefined], expected: -1 },
    { name: 'from', args: [[1, 2, 1], 1, 1], expected: 2 },
    { name: 'fromTheEnd', args: [[1, 2, 1], 1, -1], expected: 2 },
    { name: 'fromBeforeTheStart', args: [[1, 2, 1], 1, -9], expected: 0 },
    { name: 'fromPastTheEnd', args: [[1, 2, 1], 1, 3], expected: -1 },
    { name: 'fromNegativeInfinity', args: [[1], 1, -Infinity], expected: 0 },
    { name: 'emptyBigintFrom', args: [[], 1, 1n], expected: -1 },
    { name: 'bigintFrom', args: [[1], 1, 1n], expected: throws },
    { name: 'object', args: [{}, 1], expected: throws },
    { name: 'stringFirst', args: ['abcabc', 'bc'], expected: 1 },
    { name: 'stringFrom', args: ['abcabc', 'bc', 2], expected: 4 },
    { name: 'stringNotFound', args: ['abc', 'z'], expected: -1 },
    { name: 'stringEmpty', args: ['abc', ''], expected: 0 },
    { name: 'stringEmptyPastTheEnd', args: ['abc', '', 10], expected: 3 },
    { name: 'stringLonger', args: ['ab', 'abc'], expected: -1 },
    { name: 'stringLowSurrogate', args: ['\u{1F600}', '\uDE00'], expected: 1 },
    { name: 'stringBigintFrom', args: ['abc', 'a', 0n], expected: throws },
]

/**
 * `Array.prototype.lastIndexOf`: strict equality, searching back from the
 * end — unless a position is passed, `undefined` included, which converts
 * to `0`.
 *
 * @type {readonly MethodCase[]}
 */
const lastIndexOfCases = [
    { name: 'last', args: [[1, 2, 1], 1], expected: 2 },
    { name: 'notFound', args: [[1, 2, 3], 4], expected: -1 },
    { name: 'nan', args: [[NaN], NaN], expected: -1 },
    { name: 'negativeZero', args: [[0, 1], -0], expected: 0 },
    { name: 'noArgument', args: [[undefined, 1]], expected: 0 },
    { name: 'empty', args: [[], undefined], expected: -1 },
    { name: 'passedUndefined', args: [[1, 1], 1, undefined], expected: 0 },
    { name: 'from', args: [[1, 2, 1], 1, 1], expected: 0 },
    { name: 'fromTheEnd', args: [[1, 2, 1], 1, -2], expected: 0 },
    { name: 'fromBeforeTheStart', args: [[1, 2, 1], 1, -4], expected: -1 },
    { name: 'fromPastTheEnd', args: [[1, 2, 1], 1, 9], expected: 2 },
    { name: 'fromNegativeInfinity', args: [[1], 1, -Infinity], expected: -1 },
    { name: 'fromInfinity', args: [[1], 1, Infinity], expected: 0 },
    { name: 'emptyBigintFrom', args: [[], 1, 1n], expected: -1 },
    { name: 'bigintFrom', args: [[1], 1, 1n], expected: throws },
    { name: 'stringLast', args: ['abcabc', 'bc'], expected: 4 },
    { name: 'stringFrom', args: ['abcabc', 'bc', 3], expected: 1 },
    { name: 'stringUndefinedIsTheEnd', args: ['aa', 'a', undefined], expected: 1 },
    { name: 'stringNanIsTheEnd', args: ['aa', 'a', NaN], expected: 1 },
    { name: 'stringZero', args: ['aa', 'a', 0], expected: 0 },
    { name: 'stringNegative', args: ['aa', 'a', -1], expected: 0 },
    { name: 'stringEmpty', args: ['abc', ''], expected: 3 },
    { name: 'stringNotFound', args: ['abc', 'z'], expected: -1 },
    { name: 'stringLonger', args: ['ab', 'abc'], expected: -1 },
    { name: 'stringBigintFrom', args: ['abc', 'a', 0n], expected: throws },
]

/**
 * `Array.prototype.slice`: the elements from a start up to an end, both
 * relative positions clamped into the array, the end the length when
 * `undefined`.
 *
 * @type {readonly MethodCase[]}
 */
const sliceCases = [
    { name: 'noArgument', args: [[1, 2, 3]], expected: [1, 2, 3] },
    { name: 'start', args: [[1, 2, 3], 1], expected: [2, 3] },
    { name: 'startAndEnd', args: [[1, 2, 3], 0, 2], expected: [1, 2] },
    { name: 'fromTheEnd', args: [[1, 2, 3], -2, -1], expected: [2] },
    { name: 'undefinedEnd', args: [[1, 2, 3], 1, undefined], expected: [2, 3] },
    { name: 'nullEnd', args: [[1, 2, 3], 0, null], expected: [] },
    { name: 'emptyRange', args: [[1, 2, 3], 2, 1], expected: [] },
    { name: 'clamped', args: [[1, 2, 3], -9, 9], expected: [1, 2, 3] },
    { name: 'truncated', args: [[1, 2, 3], 0.9, 2.9], expected: [1, 2] },
    { name: 'string', args: [[1, 2, 3], '1', '2'], expected: [2] },
    { name: 'empty', args: [[], 0, 1], expected: [] },
    { name: 'nested', args: [[[1], [2]], 1], expected: [[2]] },
    { name: 'bigintStart', args: [[1], 0n], expected: throws },
    { name: 'bigintEnd', args: [[1], 0, 1n], expected: throws },
    { name: 'stringStart', args: ['abcdef', 2], expected: 'cdef' },
    { name: 'stringFromTheEnd', args: ['abcdef', -3, -1], expected: 'de' },
    { name: 'stringEmptyRange', args: ['abc', 2, 1], expected: '' },
    { name: 'stringUndefinedEnd', args: ['abc', 1, undefined], expected: 'bc' },
    { name: 'stringNoArgument', args: ['abc'], expected: 'abc' },
    { name: 'stringHalfAPair', args: ['\u{1F600}', 1], expected: '\uDE00' },
    { name: 'stringBigint', args: ['abc', 0n], expected: throws },
]

/**
 * `Array.prototype.concat`: the receiver's elements, then each argument's —
 * an array spliced in one level, anything else, an object included, whole.
 *
 * @type {readonly MethodCase[]}
 */
const concatCases = [
    { name: 'noArgument', args: [[1, 2]], expected: [1, 2] },
    { name: 'array', args: [[1], [2, 3]], expected: [1, 2, 3] },
    { name: 'value', args: [[1], 2], expected: [1, 2] },
    { name: 'several', args: [[1], 2, [3], [], 4], expected: [1, 2, 3, 4] },
    { name: 'oneLevel', args: [[1], [[2]]], expected: [1, [2]] },
    { name: 'object', args: [[], { a: 1 }], expected: [{ a: 1 }] },
    { name: 'nullish', args: [[], null, undefined], expected: [null, undefined] },
    { name: 'string', args: [[], 'ab'], expected: ['ab'] },
    { name: 'empty', args: [[]], expected: [] },
    { name: 'stringValues', args: ['a', 1, null, [2, 3], undefined], expected: 'a1null2,3undefined' },
    { name: 'stringNoArgument', args: ['a'], expected: 'a' },
    { name: 'stringObject', args: ['', {}], expected: '[object Object]' },
    { name: 'stringBigint', args: ['a', 1n], expected: 'a1' },
]

/** `Array.prototype.toReversed`: the elements in reverse order. @type {readonly MethodCase[]} */
const toReversedCases = [
    { name: 'reversed', args: [[1, 2, 3]], expected: [3, 2, 1] },
    { name: 'empty', args: [[]], expected: [] },
    { name: 'argumentIgnored', args: [[1, 2], 0], expected: [2, 1] },
    { name: 'nested', args: [[[1], 2]], expected: [2, [1]] },
]

/**
 * `Array.prototype.with`: a copy with one element replaced, the index a
 * relative position that must land inside the array.
 *
 * @type {readonly MethodCase[]}
 */
const withCases = [
    { name: 'first', args: [[1, 2, 3], 0, 9], expected: [9, 2, 3] },
    { name: 'fromTheEnd', args: [[1, 2, 3], -1, 9], expected: [1, 2, 9] },
    { name: 'truncated', args: [[1, 2, 3], 1.5, 9], expected: [1, 9, 3] },
    { name: 'string', args: [[1, 2, 3], '2', 9], expected: [1, 2, 9] },
    { name: 'noValue', args: [[1, 2], 0], expected: [undefined, 2] },
    { name: 'noArgument', args: [[1, 2]], expected: [undefined, 2] },
    { name: 'pastTheEnd', args: [[1, 2, 3], 3, 9], expected: throws },
    { name: 'beforeTheStart', args: [[1, 2, 3], -4, 9], expected: throws },
    { name: 'empty', args: [[], 0, 9], expected: throws },
    { name: 'infinity', args: [[1], Infinity, 9], expected: throws },
    { name: 'bigint', args: [[1], 0n, 9], expected: throws },
]

/**
 * `Array.prototype.toSpliced`: a copy with elements removed from a start
 * and items put in their place. How many go depends on what the call
 * passed: none without a start, the rest without a count, and a passed
 * `undefined` count is zero.
 *
 * @type {readonly MethodCase[]}
 */
const toSplicedCases = [
    { name: 'noArgument', args: [[1, 2, 3]], expected: [1, 2, 3] },
    { name: 'start', args: [[1, 2, 3], 1], expected: [1] },
    { name: 'startUndefinedCount', args: [[1, 2, 3], 1, undefined], expected: [1, 2, 3] },
    { name: 'undefinedStart', args: [[1, 2, 3], undefined], expected: [] },
    { name: 'count', args: [[1, 2, 3], 1, 1], expected: [1, 3] },
    { name: 'insert', args: [[1, 2, 3], 1, 1, 8, 9], expected: [1, 8, 9, 3] },
    { name: 'insertOnly', args: [[1, 3], 1, 0, 2], expected: [1, 2, 3] },
    { name: 'fromTheEnd', args: [[1, 2, 3], -1, 1], expected: [1, 2] },
    { name: 'countPastTheEnd', args: [[1, 2, 3], 1, 9], expected: [1] },
    { name: 'negativeCount', args: [[1, 2], 0, -1, 0], expected: [0, 1, 2] },
    { name: 'startPastTheEnd', args: [[1], 9, 0, 2], expected: [1, 2] },
    { name: 'stringCount', args: [[1, 2, 3], 0, '2'], expected: [3] },
    { name: 'arrayItem', args: [[1], 1, 0, [2]], expected: [1, [2]] },
    { name: 'empty', args: [[], 0, 0, 1], expected: [1] },
    { name: 'bigintStart', args: [[1], 0n], expected: throws },
    { name: 'bigintCount', args: [[1], 0, 1n], expected: throws },
]

/**
 * `Array.prototype.join`: the elements as strings, `undefined` and `null`
 * as the empty string and a nested array by its own `toString`, joined by
 * `","` when the separator is absent or `undefined`, and otherwise by the
 * separator as a string, so `null` joins with `"null"`. A function element
 * is not written here, for the reason at {@link FunctionValue}.
 *
 * @type {readonly MethodCase[]}
 */
const joinCases = [
    { name: 'noArgument', args: [[1, 2, 3]], expected: '1,2,3' },
    { name: 'undefinedSeparator', args: [[1, 2], undefined], expected: '1,2' },
    { name: 'separator', args: [[1, 2], '-'], expected: '1-2' },
    { name: 'emptySeparator', args: [[1, 2], ''], expected: '12' },
    { name: 'nullSeparator', args: [[1, 2], null], expected: '1null2' },
    { name: 'numberSeparator', args: [[1, 2], 0], expected: '102' },
    { name: 'arraySeparator', args: [[1, 2], [3, 4]], expected: '13,42' },
    { name: 'nullish', args: [[null, undefined, 1], ';'], expected: ';;1' },
    { name: 'nested', args: [[1, [2, [3, null]]], ';'], expected: '1;2,3,' },
    { name: 'values', args: [[true, 5n, 'a', {}, -0]], expected: 'true,5,a,[object Object],0' },
    { name: 'empty', args: [[], '-'], expected: '' },
    { name: 'one', args: [[1], '-'], expected: '1' },
    { name: 'bigintSeparator', args: [[1, 2], 0n], expected: '102' },
]

/**
 * The callback checks every iteration shares: a callback that is not a
 * function throws before any element is visited, an empty array included,
 * and a second argument, the `thisArg` JavaScript binds as `this`, has no
 * effect, since no function here reads `this`.
 *
 * @type {(name: string, ok: Expectation) => readonly MethodCase[]}
 */
const callbackChecks = (name, ok) => [
    { name: `${name}NotAFunction`, args: [[1], 1], expected: throws },
    { name: `${name}EmptyNotAFunction`, args: [[], null], expected: throws },
    { name: `${name}NoCallback`, args: [[]], expected: throws },
    { name: `${name}ThisArg`, args: [[{ x: 1 }], callback('prop'), { x: 0 }], expected: ok },
    { name: `${name}Object`, args: [{}, callback('prop')], expected: throws },
]

/** `Array.prototype.every`: `false` at the first falsy answer. @type {readonly MethodCase[]} */
const everyCases = [
    { name: 'all', args: [[1, 2], callback('first')], expected: true },
    { name: 'one', args: [[1, 0, 2], callback('first')], expected: false },
    { name: 'empty', args: [[], callback('first')], expected: true },
    { name: 'stops', args: [[{}, null], callback('prop')], expected: false },
    { name: 'reachesThrow', args: [[{ x: 1 }, null], callback('prop')], expected: throws },
    ...callbackChecks('every', true),
]

/** `Array.prototype.some`: `true` at the first truthy answer. @type {readonly MethodCase[]} */
const someCases = [
    { name: 'one', args: [[0, 1], callback('first')], expected: true },
    { name: 'none', args: [[0, '', null], callback('first')], expected: false },
    { name: 'empty', args: [[], callback('first')], expected: false },
    { name: 'stops', args: [[{ x: 1 }, null], callback('prop')], expected: true },
    { name: 'reachesThrow', args: [[{}, null], callback('prop')], expected: throws },
    ...callbackChecks('some', true),
]

/** `Array.prototype.find`: the first element answering truthy, or `undefined`. @type {readonly MethodCase[]} */
const findCases = [
    { name: 'first', args: [[{ x: 0 }, { x: 1, n: 1 }, { x: 1, n: 2 }], callback('prop')], expected: { x: 1, n: 1 } },
    { name: 'none', args: [[0, ''], callback('first')], expected: undefined },
    { name: 'empty', args: [[], callback('first')], expected: undefined },
    { name: 'stops', args: [[{ x: 1 }, null], callback('prop')], expected: { x: 1 } },
    ...callbackChecks('find', { x: 1 }),
]

/** `Array.prototype.findIndex`: the first index answering truthy, or `-1`. @type {readonly MethodCase[]} */
const findIndexCases = [
    { name: 'first', args: [[0, 1, 2], callback('first')], expected: 1 },
    { name: 'none', args: [[0, ''], callback('first')], expected: -1 },
    { name: 'empty', args: [[], callback('first')], expected: -1 },
    { name: 'stops', args: [[{ x: 1 }, null], callback('prop')], expected: 0 },
    ...callbackChecks('findIndex', 0),
]

/** `Array.prototype.findLast`: the last element answering truthy, visiting from the end. @type {readonly MethodCase[]} */
const findLastCases = [
    { name: 'last', args: [[{ x: 1, n: 1 }, { x: 1, n: 2 }, { x: 0 }], callback('prop')], expected: { x: 1, n: 2 } },
    { name: 'none', args: [[0, ''], callback('first')], expected: undefined },
    { name: 'empty', args: [[], callback('first')], expected: undefined },
    { name: 'stops', args: [[null, { x: 1 }], callback('prop')], expected: { x: 1 } },
    ...callbackChecks('findLast', { x: 1 }),
]

/** `Array.prototype.findLastIndex`: the last index answering truthy, or `-1`. @type {readonly MethodCase[]} */
const findLastIndexCases = [
    { name: 'last', args: [[1, 2, 0], callback('first')], expected: 1 },
    { name: 'none', args: [[0, ''], callback('first')], expected: -1 },
    { name: 'empty', args: [[], callback('first')], expected: -1 },
    { name: 'stops', args: [[null, { x: 1 }], callback('prop')], expected: 1 },
    ...callbackChecks('findLastIndex', 0),
]

/**
 * `Array.prototype.map`: every answer, in order. The `args` callback pins
 * what each call is handed: the element, its index and the array.
 *
 * @type {readonly MethodCase[]}
 */
const mapCases = [
    { name: 'double', args: [[1, 2], callback('double')], expected: [2, 4] },
    { name: 'arguments', args: [[10, 20], callback('args')], expected: [[10, 0, [10, 20]], [20, 1, [10, 20]]] },
    { name: 'empty', args: [[], callback('double')], expected: [] },
    { name: 'undefinedAnswers', args: [[{}, {}], callback('prop')], expected: [undefined, undefined] },
    { name: 'throw', args: [[{}, null], callback('prop')], expected: throws },
    ...callbackChecks('map', [1]),
]

/** `Array.prototype.filter`: the elements answering truthy, in order. @type {readonly MethodCase[]} */
const filterCases = [
    { name: 'truthy', args: [[0, 1, '', 'a', null, 2], callback('first')], expected: [1, 'a', 2] },
    { name: 'none', args: [[0, ''], callback('first')], expected: [] },
    { name: 'empty', args: [[], callback('first')], expected: [] },
    { name: 'elementsNotAnswers', args: [[{ x: 1 }, { x: 0 }], callback('prop')], expected: [{ x: 1 }] },
    { name: 'throw', args: [[{}, null], callback('prop')], expected: throws },
    ...callbackChecks('filter', [{ x: 1 }]),
]

/**
 * `Array.prototype.reduce`: folded from the start, the accumulator the
 * initial value when the call passed one, `undefined` included, and
 * otherwise the first element — so an empty array with none throws, and
 * one with a passed `undefined` answers it.
 *
 * @type {readonly MethodCase[]}
 */
const reduceCases = [
    { name: 'sum', args: [[1, 2, 3], callback('add')], expected: 6 },
    { name: 'order', args: [['a', 'b', 'c'], callback('add')], expected: 'abc' },
    { name: 'initial', args: [['a', 'b'], callback('add'), '>'], expected: '>ab' },
    { name: 'one', args: [[1], callback('add')], expected: 1 },
    { name: 'emptyInitial', args: [[], callback('add'), 0], expected: 0 },
    { name: 'emptyUndefinedInitial', args: [[], callback('add'), undefined], expected: undefined },
    { name: 'arguments', args: [[10, 20], callback('args')], expected: [10, 20, 1, [10, 20]] },
    { name: 'empty', args: [[], callback('add')], expected: throws },
    { name: 'notAFunction', args: [[1], 1], expected: throws },
    { name: 'emptyNotAFunction', args: [[], 1, 0], expected: throws },
    { name: 'object', args: [{}, callback('add')], expected: throws },
]

/** `Array.prototype.reduceRight`: the same, from the end. @type {readonly MethodCase[]} */
const reduceRightCases = [
    { name: 'sum', args: [[1, 2, 3], callback('add')], expected: 6 },
    { name: 'order', args: [['a', 'b', 'c'], callback('add')], expected: 'cba' },
    { name: 'initial', args: [['a', 'b'], callback('add'), '>'], expected: '>ba' },
    { name: 'emptyUndefinedInitial', args: [[], callback('add'), undefined], expected: undefined },
    { name: 'arguments', args: [[10, 20], callback('args')], expected: [20, 10, 0, [10, 20]] },
    { name: 'empty', args: [[], callback('add')], expected: throws },
    { name: 'notAFunction', args: [[1], 1], expected: throws },
]

/**
 * `Array.prototype.flat`: an element that is an array spliced in, to a
 * depth — `1` when absent or `undefined`, all the way for `Infinity`, a
 * copy at `0` or below.
 *
 * @type {readonly MethodCase[]}
 */
const flatCases = [
    { name: 'oneLevel', args: [[1, [2, [3, [4]]]]], expected: [1, 2, [3, [4]]] },
    { name: 'undefinedDepth', args: [[1, [2, [3]]], undefined], expected: [1, 2, [3]] },
    { name: 'twoLevels', args: [[1, [2, [3, [4]]]], 2], expected: [1, 2, 3, [4]] },
    { name: 'infinity', args: [[1, [2, [3, [4]]]], Infinity], expected: [1, 2, 3, 4] },
    { name: 'zero', args: [[1, [2]], 0], expected: [1, [2]] },
    { name: 'negative', args: [[1, [2]], -1], expected: [1, [2]] },
    { name: 'truncated', args: [[1, [2, [3]]], 1.9], expected: [1, 2, [3]] },
    { name: 'string', args: [[1, [2, [3]]], '2'], expected: [1, 2, 3] },
    { name: 'nullIsZero', args: [[1, [2]], null], expected: [1, [2]] },
    { name: 'emptyArrays', args: [[[], [[]], 1]], expected: [[], 1] },
    { name: 'objectWhole', args: [[{ a: [1] }, [{ b: 2 }]]], expected: [{ a: [1] }, { b: 2 }] },
    { name: 'empty', args: [[]], expected: [] },
    { name: 'bigint', args: [[1], 1n], expected: throws },
    { name: 'object', args: [{}], expected: throws },
]

/**
 * `Array.prototype.flatMap`: `map`, then one level of `flat` — an answer
 * that is an array spliced in, its own elements as they are.
 *
 * @type {readonly MethodCase[]}
 */
const flatMapCases = [
    { name: 'oneLevelOnly', args: [[1, 2], callback('pair')], expected: [1, [1], 2, [2]] },
    { name: 'notArrays', args: [[1, 2], callback('double')], expected: [2, 4] },
    { name: 'arguments', args: [[10], callback('args')], expected: [10, 0, [10]] },
    { name: 'emptyAnswer', args: [[[], [1]], callback('first')], expected: [1] },
    { name: 'empty', args: [[], callback('pair')], expected: [] },
    { name: 'throw', args: [[{}, null], callback('prop')], expected: throws },
    ...callbackChecks('flatMap', [1]),
]

/**
 * `Array.prototype.toSorted`: a stable sort into a new array, `undefined`
 * elements last and never compared. With no comparator elements compare as
 * strings, so `10` sorts before `9`; a comparator must be a function or
 * `undefined`, `null` included in what it must not be. A comparator's
 * answer is read by `ToNumber`, `NaN` as `0`. Only consistent comparators
 * are pinned here: ECMAScript leaves the order an inconsistent one gives to
 * the engine.
 *
 * @type {readonly MethodCase[]}
 */
const toSortedCases = [
    { name: 'asStrings', args: [[10, 9, 1]], expected: [1, 10, 9] },
    { name: 'undefinedComparator', args: [[3, 1, 2], undefined], expected: [1, 2, 3] },
    { name: 'undefinedLast', args: [[3, undefined, 1, null]], expected: [1, 3, null, undefined] },
    { name: 'mixed', args: [[true, 'a', 10, 2n, 'B']], expected: [10, 2n, 'B', 'a', true] },
    { name: 'nested', args: [[[2], [1, 5], [1]]], expected: [[1], [1, 5], [2]] },
    { name: 'ascending', args: [[10, 9, 1], callback('ascending')], expected: [1, 9, 10] },
    { name: 'descending', args: [[1, 10, 9], callback('descending')], expected: [10, 9, 1] },
    { name: 'undefinedNeverCompared', args: [[2, undefined, 1], callback('ascending')], expected: [1, 2, undefined] },
    { name: 'nanAnswerIsEqual', args: [[3, 1, 2], callback('prop')], expected: [3, 1, 2] },
    // Every pair equal: a stable sort keeps the order, so this is what
    // tells `> 0` from `>= 0` in the comparator's reading.
    { name: 'stable', args: [[3, 1, 2], callback('zero')], expected: [3, 1, 2] },
    { name: 'stableUndefinedLast', args: [[3, undefined, 1, 2], callback('zero')], expected: [3, 1, 2, undefined] },
    { name: 'empty', args: [[]], expected: [] },
    { name: 'one', args: [[1], callback('ascending')], expected: [1] },
    { name: 'nullComparator', args: [[2, 1], null], expected: throws },
    { name: 'numberComparator', args: [[2, 1], 1], expected: throws },
    { name: 'emptyNotAFunction', args: [[], 1], expected: throws },
    { name: 'bigintAnswer', args: [[2n, 1n], callback('first')], expected: throws },
    // Which of two elements a comparator is handed first is the engine's
    // choice, so a throwing case throws whichever way round it is called.
    { name: 'throwingComparator', args: [[null, null], callback('prop')], expected: throws },
    { name: 'object', args: [{}], expected: throws },
]

/**
 * `String.prototype.charAt`: the code unit at a position never counted from
 * the end, as a string, or `""`.
 *
 * @type {readonly MethodCase[]}
 */
const charAtCases = [
    { name: 'first', args: ['abc', 0], expected: 'a' },
    { name: 'last', args: ['abc', 2], expected: 'c' },
    { name: 'negative', args: ['abc', -1], expected: '' },
    { name: 'pastTheEnd', args: ['abc', 3], expected: '' },
    { name: 'noArgument', args: ['abc'], expected: 'a' },
    { name: 'truncated', args: ['abc', 1.9], expected: 'b' },
    { name: 'string', args: ['abc', '2'], expected: 'c' },
    { name: 'nan', args: ['abc', NaN], expected: 'a' },
    { name: 'infinity', args: ['abc', Infinity], expected: '' },
    { name: 'codeUnit', args: ['\u{1F600}', 1], expected: '\uDE00' },
    { name: 'empty', args: ['', 0], expected: '' },
    { name: 'bigint', args: ['abc', 0n], expected: throws },
]

/** `String.prototype.charCodeAt`: the code unit as a number, or `NaN`. @type {readonly MethodCase[]} */
const charCodeAtCases = [
    { name: 'first', args: ['abc', 0], expected: 97 },
    { name: 'noArgument', args: ['abc'], expected: 97 },
    { name: 'negative', args: ['abc', -1], expected: NaN },
    { name: 'pastTheEnd', args: ['abc', 3], expected: NaN },
    { name: 'highSurrogate', args: ['\u{1F600}', 0], expected: 0xD83D },
    { name: 'lowSurrogate', args: ['\u{1F600}', 1], expected: 0xDE00 },
    { name: 'bigint', args: ['abc', 0n], expected: throws },
]

/**
 * `String.prototype.codePointAt`: the code point of a surrogate pair
 * starting at the position, else the code unit, or `undefined`.
 *
 * @type {readonly MethodCase[]}
 */
const codePointAtCases = [
    { name: 'ascii', args: ['abc', 1], expected: 98 },
    { name: 'pair', args: ['\u{1F600}', 0], expected: 0x1F600 },
    { name: 'lowHalf', args: ['\u{1F600}', 1], expected: 0xDE00 },
    { name: 'loneHigh', args: ['\uD83Da', 0], expected: 0xD83D },
    { name: 'pastTheEnd', args: ['abc', 3], expected: undefined },
    { name: 'negative', args: ['abc', -1], expected: undefined },
    { name: 'noArgument', args: ['\u{1F600}'], expected: 0x1F600 },
    { name: 'bigint', args: ['abc', 0n], expected: throws },
]

/** `String.prototype.isWellFormed`: no surrogate is unpaired. @type {readonly MethodCase[]} */
const isWellFormedCases = [
    { name: 'ascii', args: ['abc'], expected: true },
    { name: 'pair', args: ['a\u{1F600}b'], expected: true },
    { name: 'loneHigh', args: ['a\uD83D'], expected: false },
    { name: 'loneLow', args: ['\uDE00a'], expected: false },
    { name: 'reversedPair', args: ['\uDE00\uD83D'], expected: false },
    { name: 'empty', args: [''], expected: true },
]

/** `String.prototype.toWellFormed`: each unpaired surrogate replaced by U+FFFD. @type {readonly MethodCase[]} */
const toWellFormedCases = [
    { name: 'ascii', args: ['abc'], expected: 'abc' },
    { name: 'pair', args: ['a\u{1F600}b'], expected: 'a\u{1F600}b' },
    { name: 'lone', args: ['a\uD800b\uDC00'], expected: 'a\uFFFDb\uFFFD' },
    { name: 'reversedPair', args: ['\uDE00\uD83D'], expected: '\uFFFD\uFFFD' },
    { name: 'empty', args: [''], expected: '' },
]

/**
 * `String.prototype.startsWith`: the search string at a position clamped
 * into the string, `0` when `undefined`.
 *
 * @type {readonly MethodCase[]}
 */
const startsWithCases = [
    { name: 'prefix', args: ['abc', 'ab'], expected: true },
    { name: 'notPrefix', args: ['abc', 'bc'], expected: false },
    { name: 'at', args: ['abc', 'bc', 1], expected: true },
    { name: 'empty', args: ['abc', ''], expected: true },
    { name: 'longer', args: ['ab', 'abc'], expected: false },
    { name: 'negative', args: ['abc', 'a', -1], expected: true },
    { name: 'pastTheEnd', args: ['abc', '', 9], expected: true },
    { name: 'noArgument', args: ['undefinedx'], expected: true },
    { name: 'number', args: ['12', 1], expected: true },
    { name: 'bigintPosition', args: ['abc', 'a', 0n], expected: throws },
]

/**
 * `String.prototype.endsWith`: the search string ending at a position
 * clamped into the string, the length when `undefined`.
 *
 * @type {readonly MethodCase[]}
 */
const endsWithCases = [
    { name: 'suffix', args: ['abc', 'bc'], expected: true },
    { name: 'notSuffix', args: ['abc', 'ab'], expected: false },
    { name: 'at', args: ['abc', 'ab', 2], expected: true },
    { name: 'undefinedEnd', args: ['abc', 'c', undefined], expected: true },
    { name: 'empty', args: ['abc', ''], expected: true },
    { name: 'longer', args: ['bc', 'abc'], expected: false },
    { name: 'pastTheEnd', args: ['abc', 'c', 9], expected: true },
    { name: 'negative', args: ['abc', '', -1], expected: true },
    { name: 'zero', args: ['abc', 'a', 0], expected: false },
    { name: 'bigintEnd', args: ['abc', 'a', 1n], expected: throws },
]

/**
 * `String.prototype.substring`: two positions never counted from the end,
 * clamped, and swapped if the start is past the end.
 *
 * @type {readonly MethodCase[]}
 */
const substringCases = [
    { name: 'range', args: ['abcdef', 1, 4], expected: 'bcd' },
    { name: 'swapped', args: ['abcdef', 4, 1], expected: 'bcd' },
    { name: 'negativeIsZero', args: ['abc', -1, 2], expected: 'ab' },
    { name: 'nanIsZero', args: ['abc', NaN, 2], expected: 'ab' },
    { name: 'undefinedEnd', args: ['abc', 1, undefined], expected: 'bc' },
    { name: 'nullEnd', args: ['abc', 2, null], expected: 'ab' },
    { name: 'pastTheEnd', args: ['abc', 1, 9], expected: 'bc' },
    { name: 'noArgument', args: ['abc'], expected: 'abc' },
    { name: 'bigint', args: ['abc', 0n], expected: throws },
]

/**
 * `String.prototype.repeat`: the receiver a count of times; a negative or
 * infinite count is a `RangeError`, even on `""`.
 *
 * @type {readonly MethodCase[]}
 */
const repeatCases = [
    { name: 'twice', args: ['ab', 2], expected: 'abab' },
    { name: 'truncated', args: ['ab', 2.9], expected: 'abab' },
    { name: 'zero', args: ['ab', 0], expected: '' },
    { name: 'noArgument', args: ['ab'], expected: '' },
    { name: 'string', args: ['a', '3'], expected: 'aaa' },
    { name: 'emptyMany', args: ['', 1000], expected: '' },
    { name: 'negative', args: ['a', -1], expected: throws },
    { name: 'infinity', args: ['a', Infinity], expected: throws },
    { name: 'emptyInfinity', args: ['', Infinity], expected: throws },
    { name: 'bigint', args: ['a', 1n], expected: throws },
]

/**
 * `String.prototype.padStart`: the fill repeated and cut to reach a
 * length, before the receiver. `undefined` fills with spaces, `null` with
 * `"null"`, an empty fill with nothing.
 *
 * @type {readonly MethodCase[]}
 */
const padStartCases = [
    { name: 'zeros', args: ['5', 3, '0'], expected: '005' },
    { name: 'cut', args: ['abc', 8, 'xy'], expected: 'xyxyxabc' },
    { name: 'spaces', args: ['a', 3], expected: '  a' },
    { name: 'undefinedFill', args: ['a', 3, undefined], expected: '  a' },
    { name: 'nullFill', args: ['a', 3, null], expected: 'nua' },
    { name: 'emptyFill', args: ['a', 5, ''], expected: 'a' },
    { name: 'shorter', args: ['abc', 2, 'x'], expected: 'abc' },
    { name: 'negative', args: ['abc', -1, 'x'], expected: 'abc' },
    { name: 'noArgument', args: ['abc'], expected: 'abc' },
    { name: 'numberFill', args: ['7', 3, 0], expected: '007' },
    { name: 'bigintLength', args: ['a', 3n], expected: throws },
]

/** `String.prototype.padEnd`: the same, after the receiver. @type {readonly MethodCase[]} */
const padEndCases = [
    { name: 'dots', args: ['a', 4, '.'], expected: 'a...' },
    { name: 'cut', args: ['abc', 8, 'xy'], expected: 'abcxyxyx' },
    { name: 'spaces', args: ['a', 3], expected: 'a  ' },
    { name: 'emptyFill', args: ['a', 5, ''], expected: 'a' },
    { name: 'shorter', args: ['abc', 2, 'x'], expected: 'abc' },
    { name: 'bigintLength', args: ['a', 3n], expected: throws },
]

/**
 * `String.prototype.trim`, `trimStart`, `trimEnd`: ECMAScript `WhiteSpace`
 * and `LineTerminator` off the ends — the byte-order mark and U+3000
 * included.
 *
 * @type {(start: boolean, end: boolean) => readonly MethodCase[]}
 */
const trimCases = (start, end) => {
    const padded = ' \t\n\uFEFFa b\u3000\r\n'
    return [
        {
            name: 'padded',
            args: [padded],
            expected: `${start ? '' : ' \t\n\uFEFF'}a b${end ? '' : '\u3000\r\n'}`,
        },
        { name: 'inner', args: ['a  b'], expected: 'a  b' },
        { name: 'blank', args: [' \t '], expected: '' },
        { name: 'empty', args: [''], expected: '' },
        { name: 'nextLineIsNotSpace', args: ['\u0085a\u0085'], expected: '\u0085a\u0085' },
        { name: 'argumentIgnored', args: [' a ', 1], expected: start && end ? 'a' : start ? 'a ' : ' a' },
    ]
}

/**
 * `String.prototype.replace`: the first occurrence of the pattern as a
 * string. A template substitutes `$$`, `$&`, `` $` `` and `$'`, and leaves
 * `$1` and `$<name>` as written, since a string pattern has no captures. A
 * function is called with the match, its position and the string.
 *
 * @type {readonly MethodCase[]}
 */
const replaceCases = [
    { name: 'first', args: ['aXbX', 'X', '-'], expected: 'a-bX' },
    { name: 'none', args: ['ab', 'z', '-'], expected: 'ab' },
    { name: 'emptyPattern', args: ['ab', '', '-'], expected: '-ab' },
    { name: 'match', args: ['aXb', 'X', '[$&]'], expected: 'a[X]b' },
    { name: 'dollar', args: ['aXb', 'X', '$$'], expected: 'a$b' },
    { name: 'before', args: ['aXb', 'X', '$`'], expected: 'aab' },
    { name: 'after', args: ['aXb', 'X', "$'"], expected: 'abb' },
    { name: 'noCaptures', args: ['aXb', 'X', '$1$<n>$'], expected: 'a$1$<n>$b' },
    { name: 'function', args: ['aXbX', 'X', callback('args')], expected: 'aX,1,aXbXbX' },
    { name: 'functionMatch', args: ['aXb', 'X', callback('first')], expected: 'aXb' },
    { name: 'undefinedPattern', args: ['aundefinedb', undefined, '-'], expected: 'a-b' },
    { name: 'numberPattern', args: ['a1b', 1, 2], expected: 'a2b' },
    { name: 'noReplacement', args: ['aXb', 'X'], expected: 'aundefinedb' },
    { name: 'undefinedAnswer', args: ['aXb', 'X', callback('prop')], expected: 'aundefinedb' },
]

/**
 * `String.prototype.replaceAll`: every non-overlapping occurrence, left to
 * right; an empty pattern matches at every position, both ends included.
 *
 * @type {readonly MethodCase[]}
 */
const replaceAllCases = [
    { name: 'all', args: ['aXbX', 'X', '-'], expected: 'a-b-' },
    { name: 'template', args: ['aXbX', 'X', '$&$&'], expected: 'aXXbXX' },
    { name: 'emptyPattern', args: ['ab', '', '-'], expected: '-a-b-' },
    { name: 'nonOverlapping', args: ['aaa', 'aa', 'b'], expected: 'ba' },
    { name: 'none', args: ['ab', 'z', '-'], expected: 'ab' },
    { name: 'positions', args: ['aXbX', 'X', callback('args')], expected: 'aX,1,aXbXbX,3,aXbX' },
    { name: 'before', args: ['aXbX', 'X', '$`'], expected: 'aabaXb' },
    { name: 'empty', args: ['', '', '-'], expected: '-' },
]

/**
 * `String.prototype.split`: the pieces between occurrences of the
 * separator as a string. The limit is `ToUint32`, and `0` answers `[]`; an
 * `undefined` separator answers the whole string; an empty one splits into
 * code units, a surrogate pair into two.
 *
 * @type {readonly MethodCase[]}
 */
const splitCases = [
    { name: 'separator', args: ['a,b,,c', ','], expected: ['a', 'b', '', 'c'] },
    { name: 'noArgument', args: ['a,b'], expected: ['a,b'] },
    { name: 'undefinedSeparator', args: ['a,b', undefined], expected: ['a,b'] },
    { name: 'emptySeparator', args: ['abc', ''], expected: ['a', 'b', 'c'] },
    { name: 'limit', args: ['a,b,c', ',', 2], expected: ['a', 'b'] },
    { name: 'limitZero', args: ['a,b', ',', 0], expected: [] },
    { name: 'limitNegativeIsHuge', args: ['a,b', ',', -1], expected: ['a', 'b'] },
    { name: 'emptyLimit', args: ['abc', '', 2], expected: ['a', 'b'] },
    { name: 'undefinedLimitZero', args: ['a', undefined, 0], expected: [] },
    { name: 'emptyString', args: ['', ','], expected: [''] },
    { name: 'emptyStringEmptySeparator', args: ['', ''], expected: [] },
    { name: 'trailing', args: ['a,', ','], expected: ['a', ''] },
    { name: 'longSeparator', args: ['a::b::', '::'], expected: ['a', 'b', ''] },
    { name: 'nullSeparator', args: ['anullb', null], expected: ['a', 'b'] },
    { name: 'pair', args: ['\u{1F600}', ''], expected: ['\uD83D', '\uDE00'] },
    { name: 'bigintLimit', args: ['a', ',', 1n], expected: throws },
]

/**
 * `Number.prototype.toFixed`: rounded on the double's exact value, the
 * larger on a tie, so `2.5` is `"3"` and `1.005` — just below its decimal
 * — is `"1.00"`. The range is checked before the number, so
 * `Infinity.toFixed(101)` throws.
 *
 * @type {readonly MethodCase[]}
 */
const toFixedCases = [
    { name: 'half', args: [0.5, 0], expected: '1' },
    { name: 'twoAndAHalf', args: [2.5, 0], expected: '3' },
    { name: 'tie', args: [1.25, 1], expected: '1.3' },
    { name: 'belowTheDecimal', args: [1.005, 2], expected: '1.00' },
    { name: 'belowTheTie', args: [1.45, 1], expected: '1.4' },
    { name: 'negative', args: [-1.5, 0], expected: '-2' },
    // A negative number rounds by its magnitude and keeps its sign.
    { name: 'negativeTie', args: [-2.5, 0], expected: '-3' },
    { name: 'negativeToZero', args: [-0.1, 0], expected: '-0' },
    { name: 'negativeZero', args: [-0, 2], expected: '0.00' },
    { name: 'smallNegative', args: [-1e-7, 2], expected: '-0.00' },
    { name: 'noArgument', args: [1.5], expected: '2' },
    { name: 'exact', args: [0.1, 25], expected: '0.1000000000000000055511151' },
    { name: 'large', args: [1e20, 2], expected: '100000000000000000000.00' },
    { name: 'tooLarge', args: [1e21, 2], expected: '1e+21' },
    { name: 'tiny', args: [1e-7, 10], expected: '0.0000001000' },
    { name: 'nan', args: [NaN, 2], expected: 'NaN' },
    { name: 'infinity', args: [Infinity, 2], expected: 'Infinity' },
    { name: 'hundred', args: [1, 100], expected: `1.${'0'.repeat(100)}` },
    { name: 'tooManyDigits', args: [1, 101], expected: throws },
    { name: 'negativeDigits', args: [1, -1], expected: throws },
    { name: 'infinityTooManyDigits', args: [Infinity, 101], expected: throws },
    { name: 'bigint', args: [1, 1n], expected: throws },
]

/**
 * `Number.prototype.toExponential`: a digit after the point per count, the
 * shortest round-tripping digits without one. A non-finite number is its
 * `ToString` before the range is checked.
 *
 * @type {readonly MethodCase[]}
 */
const toExponentialCases = [
    { name: 'digits', args: [123456, 2], expected: '1.23e+5' },
    { name: 'noArgument', args: [123456], expected: '1.23456e+5' },
    { name: 'passedUndefined', args: [1.5, undefined], expected: '1.5e+0' },
    { name: 'zero', args: [0, 2], expected: '0.00e+0' },
    { name: 'zeroNoArgument', args: [0], expected: '0e+0' },
    { name: 'tie', args: [1.25, 1], expected: '1.3e+0' },
    { name: 'negativeTie', args: [-2.5, 0], expected: '-3e+0' },
    { name: 'negativeSmall', args: [-0.00015, 1], expected: '-1.5e-4' },
    { name: 'roundsUp', args: [9.99, 1], expected: '1.0e+1' },
    { name: 'belowAPower', args: [1e23, 20], expected: '9.99999999999999916114e+22' },
    { name: 'belowAPowerRounded', args: [1e23, 0], expected: '1e+23' },
    { name: 'subnormal', args: [5e-324, 2], expected: '4.94e-324' },
    { name: 'subnormalNoArgument', args: [5e-324], expected: '5e-324' },
    { name: 'largest', args: [1.7976931348623157e308, 3], expected: '1.798e+308' },
    { name: 'infinityTooManyDigits', args: [Infinity, 101], expected: 'Infinity' },
    // The argument is converted before the number is looked at.
    { name: 'nanDigits', args: [1, NaN], expected: '1e+0' },
    { name: 'bigintOnInfinity', args: [Infinity, 1n], expected: throws },
    { name: 'tooManyDigits', args: [1, 101], expected: throws },
    { name: 'bigint', args: [1, 1n], expected: throws },
]

/**
 * `Number.prototype.toPrecision`: that many significant digits, with an
 * exponent below `-6` or at least the precision, plainly otherwise.
 *
 * @type {readonly MethodCase[]}
 */
const toPrecisionCases = [
    { name: 'plain', args: [123.456, 4], expected: '123.5' },
    { name: 'small', args: [0.000123, 2], expected: '0.00012' },
    { name: 'exponent', args: [123456, 2], expected: '1.2e+5' },
    { name: 'noArgument', args: [1.5], expected: '1.5' },
    { name: 'zero', args: [0, 3], expected: '0.00' },
    { name: 'negativeZero', args: [-0, 2], expected: '0.0' },
    { name: 'negativeTie', args: [-2.5, 1], expected: '-3' },
    { name: 'tiny', args: [1e-7, 1], expected: '1e-7' },
    { name: 'smallestPlain', args: [0.000001, 1], expected: '0.000001' },
    { name: 'roundsUp', args: [99.99, 3], expected: '100' },
    { name: 'tie', args: [2.5, 1], expected: '3' },
    { name: 'tieExponent', args: [25, 1], expected: '3e+1' },
    { name: 'large', args: [1e21, 3], expected: '1.00e+21' },
    { name: 'largest', args: [1.7976931348623157e308, 2], expected: '1.8e+308' },
    { name: 'exact', args: [123, 3], expected: '123' },
    { name: 'nanZero', args: [NaN, 0], expected: 'NaN' },
    // The argument is converted before the number is looked at.
    { name: 'stringPrecision', args: [1, '2.9'], expected: '1.0' },
    { name: 'bigintOnInfinity', args: [Infinity, 1n], expected: throws },
    { name: 'zeroPrecision', args: [1, 0], expected: throws },
    { name: 'tooMany', args: [1, 101], expected: throws },
    { name: 'bigint', args: [1, 1n], expected: throws },
]

/**
 * `toString()` on every type but a function, whose text is the
 * rendering `nanvm-lib/todo/member-functions.md` tracks (see
 * `FunctionValue`). A radix on a number or a bigint is read from `2` to
 * `36`; the digits of a fraction in another radix stay a `rust` gap, since
 * ECMAScript leaves them to the engine.
 *
 * @type {readonly MethodCase[]}
 */
const toStringCases = [
    { name: 'number', args: [1.5], expected: '1.5' },
    { name: 'negativeZero', args: [-0], expected: '0' },
    { name: 'boolean', args: [true], expected: 'true' },
    { name: 'string', args: ['ab'], expected: 'ab' },
    { name: 'bigint', args: [5n], expected: '5' },
    { name: 'array', args: [[1, 'b', null, undefined, [2, 3]]], expected: '1,b,,,2,3' },
    { name: 'object', args: [{}], expected: '[object Object]' },
    { name: 'radixTen', args: [255, 10], expected: '255' },
    { name: 'radixUndefined', args: [255, undefined], expected: '255' },
    { name: 'radix', args: [255, 16], expected: 'ff' },
    { name: 'radixTwo', args: [-255, 2], expected: '-11111111' },
    { name: 'radixTruncated', args: [255, 16.9], expected: 'ff' },
    { name: 'radixString', args: [255, '36'], expected: '73' },
    { name: 'radixLargeInteger', args: [1e21, 16], expected: '3635c9adc5dea00000' },
    { name: 'radixNegativeZero', args: [-0, 2], expected: '0' },
    { name: 'radixNan', args: [NaN, 2], expected: 'NaN' },
    { name: 'radixInfinity', args: [-Infinity, 16], expected: '-Infinity' },
    { name: 'radixOne', args: [255, 1], expected: throws },
    { name: 'radixThirtySeven', args: [255, 37], expected: throws },
    { name: 'radixOutOfRangeOnNan', args: [NaN, 37], expected: throws },
    { name: 'radixFraction', args: [0.5, 2], expected: '0.1', rust: 'the digits of a fraction in another radix are the engine\'s' },
    { name: 'bigintRadix', args: [255n, 16], expected: 'ff' },
    { name: 'bigintNegativeRadix', args: [-255n, 36], expected: '-73' },
    { name: 'bigintRadixTen', args: [10n, undefined], expected: '10' },
    { name: 'bigintRadixOutOfRange', args: [1n, 0], expected: throws },
    { name: 'argumentIgnored', args: [[1], 16], expected: '1' },
    { name: 'null', args: [null], expected: throws },
    { name: 'undefined', args: [undefined], expected: throws },
]
/** @type {readonly MethodGroup[]} */
export const groups = [
    { method: 'at', cases: atCases },
    { method: 'includes', cases: includesCases },
    { method: 'indexOf', cases: indexOfCases },
    { method: 'lastIndexOf', cases: lastIndexOfCases },
    { method: 'slice', cases: sliceCases },
    { method: 'concat', cases: concatCases },
    { method: 'toReversed', cases: toReversedCases },
    { method: 'with', cases: withCases },
    { method: 'toSpliced', cases: toSplicedCases },
    { method: 'join', cases: joinCases },
    { method: 'every', cases: everyCases },
    { method: 'some', cases: someCases },
    { method: 'find', cases: findCases },
    { method: 'findIndex', cases: findIndexCases },
    { method: 'findLast', cases: findLastCases },
    { method: 'findLastIndex', cases: findLastIndexCases },
    { method: 'map', cases: mapCases },
    { method: 'filter', cases: filterCases },
    { method: 'reduce', cases: reduceCases },
    { method: 'reduceRight', cases: reduceRightCases },
    { method: 'flat', cases: flatCases },
    { method: 'flatMap', cases: flatMapCases },
    { method: 'toSorted', cases: toSortedCases },
    { method: 'charAt', cases: charAtCases },
    { method: 'charCodeAt', cases: charCodeAtCases },
    { method: 'codePointAt', cases: codePointAtCases },
    { method: 'isWellFormed', cases: isWellFormedCases },
    { method: 'toWellFormed', cases: toWellFormedCases },
    { method: 'startsWith', cases: startsWithCases },
    { method: 'endsWith', cases: endsWithCases },
    { method: 'substring', cases: substringCases },
    { method: 'repeat', cases: repeatCases },
    { method: 'padStart', cases: padStartCases },
    { method: 'padEnd', cases: padEndCases },
    { method: 'trim', cases: trimCases(true, true) },
    { method: 'trimStart', cases: trimCases(true, false) },
    { method: 'trimEnd', cases: trimCases(false, true) },
    { method: 'replace', cases: replaceCases },
    { method: 'replaceAll', cases: replaceAllCases },
    { method: 'split', cases: splitCases },
    { method: 'toFixed', cases: toFixedCases },
    { method: 'toExponential', cases: toExponentialCases },
    { method: 'toPrecision', cases: toPrecisionCases },
    { method: 'toString', cases: toStringCases },
]
