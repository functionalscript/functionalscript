/**
 * The single source of truth for `nanvm-lib` operator behaviour.
 *
 * This module is pure data: it names every operator case once, with the
 * arguments and the expected result written as ordinary JavaScript values.
 * Two consumers read it, so a new case is written once and checked twice:
 *
 * - [`proof.f.mjs`](./proof.f.mjs) runs each case through the native
 *   JavaScript operators, proving that the expectations describe JavaScript.
 * - [`rust/module.f.mjs`](./rust/module.f.mjs) prints each case as Rust,
 *   producing `nanvm-lib/tests/test/generated.rs`, which runs the same case
 *   against `nanvm-lib`.
 *
 * Cases `nanvm-lib` does not implement yet carry a `rust` reason and are
 * emitted as commented-out `TODO`s instead of being silently dropped — the
 * gaps between the two implementations are part of the data.
 *
 * @module
 *
 * @import { Case, Data, Special, Value } from './types.ts'
 *
 * @example
 *
 * ```js
 * import { data } from './module.f.mjs'
 *
 * data.groups.length // 4
 * ```
 */

/**
 * A function value.
 *
 * Every operator here coerces a function through `ToPrimitive`, which never
 * inspects it, so which function it is does not matter.
 *
 * @type {Special}
 */
export const functionValue = () => ['function']

/**
 * The case must throw. Valid only as a case's `expected`.
 *
 * @type {Special}
 */
export const throws = () => ['throw']

/**
 * One of the `eq` `shared` values, so the same object reaches both sides of a
 * comparison.
 *
 * @type {(name: string) => Special}
 */
export const ref = name => () => ['ref', name]

/**
 * `+n` and `-n` share their whole argument space: both coerce with `ToNumber`
 * and differ only in the sign of the result. Listing the arguments once keeps
 * the two groups from drifting apart.
 *
 * @type {(negate: boolean) => readonly Case[]}
 */
const numberCoercionCases = negate => {
    /** @type {(v: number) => number} */
    const result = v => negate ? -v : v
    return [
        { name: 'null', args: [null], expected: result(0) },
        { name: 'undefined', args: [undefined], expected: NaN },
        { name: 'booleanFalse', args: [false], expected: result(0) },
        { name: 'booleanTrue', args: [true], expected: result(1) },
        { name: 'numberZero', args: [0], expected: result(0) },
        { name: 'numberPositive', args: [2.3], expected: result(2.3) },
        { name: 'numberNegative', args: [-2.3], expected: result(-2.3) },
        { name: 'numberLarge', args: [-239], expected: result(-239) },
        { name: 'numberInfinity', args: [Infinity], expected: result(Infinity) },
        { name: 'numberNegativeInfinity', args: [-Infinity], expected: result(-Infinity) },
        { name: 'numberNan', args: [NaN], expected: NaN },
        { name: 'stringEmpty', args: [''], expected: result(0) },
        { name: 'stringZero', args: ['0'], expected: result(0) },
        { name: 'stringNumber', args: ['2.3'], expected: result(2.3) },
        { name: 'stringExponent', args: ['2.3e2'], expected: result(230) },
        { name: 'stringNotANumber', args: ['a'], expected: NaN },
        { name: 'arrayEmpty', args: [[]], expected: result(0) },
        { name: 'arrayNumber', args: [[2.3]], expected: result(2.3) },
        { name: 'arrayNegativeNumber', args: [[-0.3]], expected: result(-0.3) },
        { name: 'arrayString', args: [['-2.3']], expected: result(-2.3) },
        { name: 'arrayPositiveString', args: [['0.3']], expected: result(0.3) },
        { name: 'arrayNull', args: [[null]], expected: result(0) },
        { name: 'arrayPair', args: [[null, null]], expected: NaN },
        { name: 'objectEmpty', args: [{}], expected: NaN },
        { name: 'function', args: [functionValue], expected: NaN },
    ]
}

/**
 * `*` between a number and a bigint throws, so the pairs below never mix the
 * two except in the case that proves it. Every pair is checked in both orders
 * — see `commutative`.
 *
 * @type {readonly Case[]}
 */
const mulCases = [
    { name: 'nullByNull', args: [null, null], expected: 0 },
    { name: 'nullByZero', args: [null, 0], expected: 0 },
    { name: 'undefinedByZero', args: [undefined, 0], expected: NaN },
    { name: 'trueByZero', args: [true, 0], expected: 0 },
    { name: 'trueByOne', args: [true, 1], expected: 1 },
    { name: 'trueByTen', args: [true, 10], expected: 10 },
    { name: 'falseByZero', args: [false, 0], expected: 0 },
    { name: 'falseByOne', args: [false, 1], expected: 0 },
    { name: 'falseByTen', args: [false, 10], expected: 0 },
    { name: 'zeroByZero', args: [0, 0], expected: 0 },
    { name: 'zeroByOne', args: [0, 1], expected: 0 },
    { name: 'oneByOne', args: [1, 1], expected: 1 },
    { name: 'oneByMinusOne', args: [1, -1], expected: -1 },
    { name: 'oneByTen', args: [1, 10], expected: 10 },
    { name: 'minusOneByTen', args: [-1, 10], expected: -10 },
    { name: 'tenByTen', args: [10, 10], expected: 100 },
    { name: 'minusTenByTen', args: [-10, 10], expected: -100 },
    { name: 'bigZeroByZero', args: [0n, 0n], expected: 0n },
    { name: 'bigZeroByOne', args: [0n, 1n], expected: 0n },
    { name: 'bigOneByOne', args: [1n, 1n], expected: 1n },
    { name: 'bigOneByMinusOne', args: [1n, -1n], expected: -1n },
    { name: 'bigOneByTen', args: [1n, 10n], expected: 10n },
    { name: 'bigMinusOneByTen', args: [-1n, 10n], expected: -10n },
    { name: 'bigTenByTen', args: [10n, 10n], expected: 100n },
    { name: 'bigMinusTenByTen', args: [-10n, 10n], expected: -100n },
    { name: 'emptyStringByOne', args: ['', 1], expected: 0 },
    { name: 'stringTenByOne', args: ['10', 1], expected: 10 },
    { name: 'stringLetterByOne', args: ['a', 1], expected: NaN },
    { name: 'stringBigintByOne', args: ['1n', 1], expected: NaN },
    { name: 'emptyArrayByOne', args: [[], 1], expected: 0 },
    { name: 'arrayTenByOne', args: [[10], 1], expected: 10 },
    { name: 'arrayStringTenByOne', args: [['10'], 1], expected: 10 },
    { name: 'arrayPairByOne', args: [[0, 0], 1], expected: NaN },
    { name: 'emptyObjectByOne', args: [{}, 1], expected: NaN },
    { name: 'numberByBigint', args: [1, 1n], expected: throws },
]

const hexadecimalBigint =
    'nanvm-lib prints bigints in hexadecimal; see nanvm-lib/todo/bigint-decimal-string-coercion.md'

/**
 * `String(x)`.
 *
 * A function's string form is its source text, which no two engines have to
 * agree on, so it is not shared data — [`proof.f.mjs`](./proof.f.mjs) checks
 * the JavaScript side separately.
 *
 * @type {readonly Case[]}
 */
const stringCoercionCases = [
    { name: 'number', args: [123], expected: '123' },
    { name: 'negativeNumber', args: [-456], expected: '-456' },
    { name: 'zero', args: [0], expected: '0' },
    { name: 'negativeZero', args: [-0], expected: '0' },
    { name: 'infinity', args: [Infinity], expected: 'Infinity' },
    { name: 'negativeInfinity', args: [-Infinity], expected: '-Infinity' },
    { name: 'nan', args: [NaN], expected: 'NaN' },
    { name: 'booleanTrue', args: [true], expected: 'true' },
    { name: 'booleanFalse', args: [false], expected: 'false' },
    { name: 'null', args: [null], expected: 'null' },
    { name: 'undefined', args: [undefined], expected: 'undefined' },
    { name: 'string', args: ['already'], expected: 'already' },
    { name: 'bigint', args: [123n], expected: '123', rust: hexadecimalBigint },
    { name: 'negativeBigint', args: [-456n], expected: '-456', rust: hexadecimalBigint },
    { name: 'emptyArray', args: [[]], expected: '' },
    { name: 'singletonArray', args: [[1]], expected: '1' },
    { name: 'array', args: [[1, 2, 3]], expected: '1,2,3' },
    { name: 'nestedArray', args: [[1, [2, 3], 4]], expected: '1,2,3,4' },
    { name: 'arrayWithNullish', args: [[null, undefined, 1]], expected: ',,1' },
    { name: 'emptyObject', args: [{}], expected: '[object Object]' },
    { name: 'object', args: [{ a: 1 }], expected: '[object Object]' },
]

/** @type {Data} */
export const data = {
    eq: {
        shared: {
            emptyArray: [],
            stringArray: ['0'],
            object: { '0': '0' },
        },
        cases: [
            { name: 'nullByNull', a: null, b: null, eq: true },
            { name: 'undefinedByUndefined', a: undefined, b: undefined, eq: true },
            { name: 'nullByUndefined', a: null, b: undefined, eq: false },
            { name: 'trueByTrue', a: true, b: true, eq: true },
            { name: 'falseByFalse', a: false, b: false, eq: true },
            { name: 'trueByFalse', a: true, b: false, eq: false },
            { name: 'falseByUndefined', a: false, b: undefined, eq: false },
            { name: 'falseByNull', a: false, b: null, eq: false },
            { name: 'numberBySameNumber', a: 2.3, b: 2.3, eq: true },
            { name: 'numberByOtherNumber', a: 2.3, b: -5.4, eq: false },
            { name: 'nanByNan', a: NaN, b: NaN, eq: false },
            { name: 'zeroByNegativeZero', a: 0, b: -0, eq: true },
            { name: 'infinityByInfinity', a: Infinity, b: Infinity, eq: true },
            {
                name: 'negativeInfinityByNegativeInfinity',
                a: -Infinity,
                b: -Infinity,
                eq: true,
            },
            { name: 'infinityByNegativeInfinity', a: Infinity, b: -Infinity, eq: false },
            { name: 'undefinedByNan', a: undefined, b: NaN, eq: false },
            { name: 'undefinedByZero', a: undefined, b: 0, eq: false },
            { name: 'stringBySameString', a: 'hello', b: 'hello', eq: true },
            { name: 'stringByOtherString', a: 'hello', b: 'world', eq: false },
            { name: 'zeroByStringZero', a: 0, b: '0', eq: false },
            { name: 'bigintBySameBigint', a: 12n, b: 12n, eq: true },
            { name: 'bigintByNegatedBigint', a: 12n, b: -12n, eq: false },
            { name: 'bigintByOtherBigint', a: 12n, b: 13n, eq: false },
            { name: 'twelveByStringTwelve', a: 12n, b: '12', eq: false },
            { name: 'arrayByItself', a: ref('emptyArray'), b: ref('emptyArray'), eq: true },
            { name: 'arrayByEqualArray', a: [], b: [], eq: false },
            { name: 'stringArrayByItself', a: ref('stringArray'), b: ref('stringArray'), eq: true },
            { name: 'objectByItself', a: ref('object'), b: ref('object'), eq: true },
            { name: 'objectByEqualObject', a: ref('object'), b: { '0': '0' }, eq: false },
        ],
    },
    groups: [
        {
            op: 'unaryPlus',
            cases: [
                ...numberCoercionCases(false),
                { name: 'bigint', args: [0n], expected: throws },
            ],
        },
        {
            op: 'unaryMinus',
            cases: [
                ...numberCoercionCases(true),
                { name: 'bigintPositive', args: [1n], expected: -1n },
                { name: 'bigintNegative', args: [-1n], expected: 1n },
            ],
        },
        { op: 'mul', commutative: true, cases: mulCases },
        { op: 'stringCoercion', cases: stringCoercionCases },
    ],
}
