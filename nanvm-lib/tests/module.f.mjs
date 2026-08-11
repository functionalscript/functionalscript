/**
 * The single source of truth for `nanvm-lib` operator behaviour.
 *
 * This module is pure data: it names every operator case once, with the
 * arguments and the expected result. Two consumers read it, so a new case is
 * written once and checked twice:
 *
 * - [`proof.f.mjs`](./proof.f.mjs) runs each case through the native
 *   JavaScript operators, proving that the expectations describe JavaScript.
 * - [`rust/module.f.mjs`](./rust/module.f.mjs) prints each case as Rust,
 *   producing [`test/generated.rs`](./test/generated.rs), which runs the same
 *   case against `nanvm-lib`.
 *
 * Cases `nanvm-lib` does not implement yet carry a `rust` reason and are
 * emitted as commented-out `TODO`s instead of being silently dropped — the
 * gaps between the two implementations are part of the data.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { data } from './module.f.mjs'
 *
 * data.groups.length // 4
 * ```
 */

/** @import { Case, Data, Entry, Expected, Value } from './types.ts' */

/** @type {Value} */
export const nullValue = ['null']

/** @type {Value} */
export const undefinedValue = ['undefined']

/**
 * A function value. Functions have no observable structure in any of the
 * operators covered here — every one of them coerces a function to `NaN` or
 * to an engine-specific string — so the tag carries no payload.
 *
 * @type {Value}
 */
export const functionValue = ['function']

/** @type {(v: boolean) => Value} */
export const boolean = v => ['boolean', v]

/** @type {(v: number) => Value} */
export const number = v => ['number', v]

/** @type {(v: string) => Value} */
export const string = v => ['string', v]

/** @type {(v: bigint) => Value} */
export const bigint = v => ['bigint', v]

/** @type {(v: readonly Value[]) => Value} */
export const array = v => ['array', v]

/** @type {(v: readonly Entry[]) => Value} */
export const object = v => ['object', v]

/** @type {(v: Value) => Expected} */
const expect = v => ['value', v]

/** @type {Expected} */
const throws = ['throw']

const nan = number(NaN)
const infinity = number(Infinity)
const negativeInfinity = number(-Infinity)
const emptyArray = array([])
const emptyObject = object([])

/**
 * `+n` and `-n` share their whole argument space: both coerce with `ToNumber`
 * and differ only in the sign of the result. Listing the arguments once keeps
 * the two groups from drifting apart.
 *
 * @type {(negate: boolean) => readonly Case[]}
 */
const numberCoercionCases = negate => {
    /** @type {(v: number) => Expected} */
    const result = v => expect(number(negate ? -v : v))
    return [
        { name: 'null', args: [nullValue], expected: result(0) },
        { name: 'undefined', args: [undefinedValue], expected: expect(nan) },
        { name: 'booleanFalse', args: [boolean(false)], expected: result(0) },
        { name: 'booleanTrue', args: [boolean(true)], expected: result(1) },
        { name: 'numberZero', args: [number(0)], expected: result(0) },
        { name: 'numberPositive', args: [number(2.3)], expected: result(2.3) },
        { name: 'numberNegative', args: [number(-2.3)], expected: result(-2.3) },
        { name: 'numberLarge', args: [number(-239)], expected: result(-239) },
        { name: 'numberInfinity', args: [infinity], expected: result(Infinity) },
        { name: 'numberNegativeInfinity', args: [negativeInfinity], expected: result(-Infinity) },
        { name: 'numberNan', args: [nan], expected: expect(nan) },
        { name: 'stringEmpty', args: [string('')], expected: result(0) },
        { name: 'stringZero', args: [string('0')], expected: result(0) },
        { name: 'stringNumber', args: [string('2.3')], expected: result(2.3) },
        { name: 'stringExponent', args: [string('2.3e2')], expected: result(230) },
        { name: 'stringNotANumber', args: [string('a')], expected: expect(nan) },
        { name: 'arrayEmpty', args: [emptyArray], expected: result(0) },
        { name: 'arrayNumber', args: [array([number(2.3)])], expected: result(2.3) },
        { name: 'arrayNegativeNumber', args: [array([number(-0.3)])], expected: result(-0.3) },
        { name: 'arrayString', args: [array([string('-2.3')])], expected: result(-2.3) },
        { name: 'arrayPositiveString', args: [array([string('0.3')])], expected: result(0.3) },
        { name: 'arrayNull', args: [array([nullValue])], expected: result(0) },
        { name: 'arrayPair', args: [array([nullValue, nullValue])], expected: expect(nan) },
        { name: 'objectEmpty', args: [emptyObject], expected: expect(nan) },
        { name: 'function', args: [functionValue], expected: expect(nan) },
    ]
}

/**
 * `*` between a number and a bigint throws, so the pairs below never mix the
 * two. Every pair is checked in both orders — see `commutative`.
 *
 * @type {readonly Case[]}
 */
const mulCases = [
    { name: 'nullByNull', args: [nullValue, nullValue], expected: expect(number(0)) },
    { name: 'nullByZero', args: [nullValue, number(0)], expected: expect(number(0)) },
    { name: 'undefinedByZero', args: [undefinedValue, number(0)], expected: expect(nan) },
    { name: 'trueByZero', args: [boolean(true), number(0)], expected: expect(number(0)) },
    { name: 'trueByOne', args: [boolean(true), number(1)], expected: expect(number(1)) },
    { name: 'trueByTen', args: [boolean(true), number(10)], expected: expect(number(10)) },
    { name: 'falseByZero', args: [boolean(false), number(0)], expected: expect(number(0)) },
    { name: 'falseByOne', args: [boolean(false), number(1)], expected: expect(number(0)) },
    { name: 'falseByTen', args: [boolean(false), number(10)], expected: expect(number(0)) },
    { name: 'zeroByZero', args: [number(0), number(0)], expected: expect(number(0)) },
    { name: 'zeroByOne', args: [number(0), number(1)], expected: expect(number(0)) },
    { name: 'oneByOne', args: [number(1), number(1)], expected: expect(number(1)) },
    { name: 'oneByMinusOne', args: [number(1), number(-1)], expected: expect(number(-1)) },
    { name: 'oneByTen', args: [number(1), number(10)], expected: expect(number(10)) },
    { name: 'minusOneByTen', args: [number(-1), number(10)], expected: expect(number(-10)) },
    { name: 'tenByTen', args: [number(10), number(10)], expected: expect(number(100)) },
    { name: 'minusTenByTen', args: [number(-10), number(10)], expected: expect(number(-100)) },
    { name: 'bigZeroByZero', args: [bigint(0n), bigint(0n)], expected: expect(bigint(0n)) },
    { name: 'bigZeroByOne', args: [bigint(0n), bigint(1n)], expected: expect(bigint(0n)) },
    { name: 'bigOneByOne', args: [bigint(1n), bigint(1n)], expected: expect(bigint(1n)) },
    { name: 'bigOneByMinusOne', args: [bigint(1n), bigint(-1n)], expected: expect(bigint(-1n)) },
    { name: 'bigOneByTen', args: [bigint(1n), bigint(10n)], expected: expect(bigint(10n)) },
    { name: 'bigMinusOneByTen', args: [bigint(-1n), bigint(10n)], expected: expect(bigint(-10n)) },
    { name: 'bigTenByTen', args: [bigint(10n), bigint(10n)], expected: expect(bigint(100n)) },
    { name: 'bigMinusTenByTen', args: [bigint(-10n), bigint(10n)], expected: expect(bigint(-100n)) },
    { name: 'emptyStringByOne', args: [string(''), number(1)], expected: expect(number(0)) },
    { name: 'stringTenByOne', args: [string('10'), number(1)], expected: expect(number(10)) },
    { name: 'stringLetterByOne', args: [string('a'), number(1)], expected: expect(nan) },
    { name: 'stringBigintByOne', args: [string('1n'), number(1)], expected: expect(nan) },
    { name: 'emptyArrayByOne', args: [emptyArray, number(1)], expected: expect(number(0)) },
    { name: 'arrayTenByOne', args: [array([number(10)]), number(1)], expected: expect(number(10)) },
    { name: 'arrayStringTenByOne', args: [array([string('10')]), number(1)], expected: expect(number(10)) },
    { name: 'arrayPairByOne', args: [array([number(0), number(0)]), number(1)], expected: expect(nan) },
    { name: 'emptyObjectByOne', args: [emptyObject, number(1)], expected: expect(nan) },
    { name: 'numberByBigint', args: [number(1), bigint(1n)], expected: throws },
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
    { name: 'number', args: [number(123)], expected: expect(string('123')) },
    { name: 'negativeNumber', args: [number(-456)], expected: expect(string('-456')) },
    { name: 'zero', args: [number(0)], expected: expect(string('0')) },
    { name: 'negativeZero', args: [number(-0)], expected: expect(string('0')) },
    { name: 'infinity', args: [infinity], expected: expect(string('Infinity')) },
    { name: 'negativeInfinity', args: [negativeInfinity], expected: expect(string('-Infinity')) },
    { name: 'nan', args: [nan], expected: expect(string('NaN')) },
    { name: 'booleanTrue', args: [boolean(true)], expected: expect(string('true')) },
    { name: 'booleanFalse', args: [boolean(false)], expected: expect(string('false')) },
    { name: 'null', args: [nullValue], expected: expect(string('null')) },
    { name: 'undefined', args: [undefinedValue], expected: expect(string('undefined')) },
    { name: 'string', args: [string('already')], expected: expect(string('already')) },
    {
        name: 'bigint',
        args: [bigint(123n)],
        expected: expect(string('123')),
        rust: hexadecimalBigint,
    },
    {
        name: 'negativeBigint',
        args: [bigint(-456n)],
        expected: expect(string('-456')),
        rust: hexadecimalBigint,
    },
    { name: 'emptyArray', args: [emptyArray], expected: expect(string('')) },
    { name: 'singletonArray', args: [array([number(1)])], expected: expect(string('1')) },
    {
        name: 'array',
        args: [array([number(1), number(2), number(3)])],
        expected: expect(string('1,2,3')),
    },
    {
        name: 'nestedArray',
        args: [array([number(1), array([number(2), number(3)]), number(4)])],
        expected: expect(string('1,2,3,4')),
    },
    {
        name: 'arrayWithNullish',
        args: [array([nullValue, undefinedValue, number(1)])],
        expected: expect(string(',,1')),
    },
    { name: 'emptyObject', args: [emptyObject], expected: expect(string('[object Object]')) },
    {
        name: 'object',
        args: [object([['a', number(1)]])],
        expected: expect(string('[object Object]')),
    },
]

/** @type {Data} */
export const data = {
    eq: {
        shared: [
            ['emptyArray', emptyArray],
            ['stringArray', array([string('0')])],
            ['object', object([['0', string('0')]])],
        ],
        cases: [
            { name: 'nullByNull', a: nullValue, b: nullValue, eq: true },
            { name: 'undefinedByUndefined', a: undefinedValue, b: undefinedValue, eq: true },
            { name: 'nullByUndefined', a: nullValue, b: undefinedValue, eq: false },
            { name: 'trueByTrue', a: boolean(true), b: boolean(true), eq: true },
            { name: 'falseByFalse', a: boolean(false), b: boolean(false), eq: true },
            { name: 'trueByFalse', a: boolean(true), b: boolean(false), eq: false },
            { name: 'falseByUndefined', a: boolean(false), b: undefinedValue, eq: false },
            { name: 'falseByNull', a: boolean(false), b: nullValue, eq: false },
            { name: 'numberBySameNumber', a: number(2.3), b: number(2.3), eq: true },
            { name: 'numberByOtherNumber', a: number(2.3), b: number(-5.4), eq: false },
            { name: 'nanByNan', a: nan, b: nan, eq: false },
            { name: 'zeroByNegativeZero', a: number(0), b: number(-0), eq: true },
            { name: 'infinityByInfinity', a: infinity, b: infinity, eq: true },
            {
                name: 'negativeInfinityByNegativeInfinity',
                a: negativeInfinity,
                b: negativeInfinity,
                eq: true,
            },
            { name: 'infinityByNegativeInfinity', a: infinity, b: negativeInfinity, eq: false },
            { name: 'undefinedByNan', a: undefinedValue, b: nan, eq: false },
            { name: 'undefinedByZero', a: undefinedValue, b: number(0), eq: false },
            { name: 'stringBySameString', a: string('hello'), b: string('hello'), eq: true },
            { name: 'stringByOtherString', a: string('hello'), b: string('world'), eq: false },
            { name: 'zeroByStringZero', a: number(0), b: string('0'), eq: false },
            { name: 'bigintBySameBigint', a: bigint(12n), b: bigint(12n), eq: true },
            { name: 'bigintByNegatedBigint', a: bigint(12n), b: bigint(-12n), eq: false },
            { name: 'bigintByOtherBigint', a: bigint(12n), b: bigint(13n), eq: false },
            { name: 'twelveByStringTwelve', a: bigint(12n), b: string('12'), eq: false },
            { name: 'arrayByItself', a: ['ref', 'emptyArray'], b: ['ref', 'emptyArray'], eq: true },
            { name: 'arrayByEqualArray', a: emptyArray, b: emptyArray, eq: false },
            {
                name: 'stringArrayByItself',
                a: ['ref', 'stringArray'],
                b: ['ref', 'stringArray'],
                eq: true,
            },
            { name: 'objectByItself', a: ['ref', 'object'], b: ['ref', 'object'], eq: true },
            {
                name: 'objectByEqualObject',
                a: ['ref', 'object'],
                b: object([['0', string('0')]]),
                eq: false,
            },
        ],
    },
    groups: [
        { op: 'unaryPlus', cases: [...numberCoercionCases(false), { name: 'bigint', args: [bigint(0n)], expected: throws }] },
        {
            op: 'unaryMinus',
            cases: [
                ...numberCoercionCases(true),
                { name: 'bigintPositive', args: [bigint(1n)], expected: expect(bigint(-1n)) },
                { name: 'bigintNegative', args: [bigint(-1n)], expected: expect(bigint(1n)) },
            ],
        },
        { op: 'mul', commutative: true, cases: mulCases },
        { op: 'stringCoercion', cases: stringCoercionCases },
    ],
}
