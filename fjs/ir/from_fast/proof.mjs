/**
 * The host proof of the lowering: [`sample.f.js`](./sample.f.js), read as
 * text, lowered from its normalized FAST, checked and emitted, runs on the
 * host's WebAssembly engine against the functions of that module
 * themselves, on the edges of their parameters' types, as
 * [`testlib.mjs`](../wasm/testlib.mjs) runs a module, and so does
 * [`helpers.f.js`](./helpers.f.js), lowered over the runtime. So do the
 * functions of [L1](../../wasm/runtime/l1/module.f.js) that the slices
 * lower so far, lowered from L1's text over the runtime, against L1's own:
 * `toBoolean` on values of every kind, `stringEquals` and `stringLess`,
 * whose loops read strings unit by unit, on pairs of strings and of other
 * values, `strictEquals` on pairs of values of every kind, and
 * `stringIndex`, whose loop keeps a record, on spellings of indices and on
 * values of other kinds. The IR that the lowering makes of each is written
 * out below, to read beside the original. So do the string helpers of
 * [`strings.f.js`](./strings.f.js), whose owned stage, which the
 * [lifetime pass](../lifetime/module.f.js) writes, is written out too: each
 * leaves every cell of the host as it found it. So do the functions of
 * [`constants.f.js`](./constants.f.js), which read the module's other
 * definitions: each call comes after `init`, which evaluates them, and
 * leaves every cell as `init` left it. So do the functions of
 * [`literals.f.js`](./literals.f.js), which read string literals that the
 * module's start function makes. So do the functions of
 * [`arrays.f.js`](./arrays.f.js), which make arrays of values that the
 * twins' arrays are, item by item: each call seals every builder that it
 * begins. So do the functions of [`reads.f.js`](./reads.f.js), which read
 * an array at a number key, on the edges of floats, and so does L1's
 * `typeOf`, on values of every kind. So do the functions of
 * [`throws.f.js`](./throws.f.js), which throw, over L1's error table, which
 * the lowering reads from the table's text, and so does L1's
 * `functionText`: each throws what its original throws, and leaves every
 * cell as it found it. So do the functions of [`builds.f.js`](./builds.f.js),
 * which build arrays by the L0 view's `buildArray`, and so does L1's
 * `toIterable`, on values of every kind and strings of code points: each
 * builds what its original builds, and throws what it throws, in the
 * view's order. A throw of a function that a callback calls abandons the
 * builder, as a trap does, which the host recovers. So do the functions of
 * [`objects.f.js`](./objects.f.js), which make records and Containers
 * objects, and L1's `objectSpread`, lowered from L1's text over the
 * runtime and the table: each builds what L1's own builds. So does L1's
 * `get`, on receivers and keys of every kind: each answers what L1's own
 * answers, and throws what it throws. So do L1's arithmetic and relational
 * operators, on numbers, bigints and strings: each answers what L1's own
 * answers, and throws what it throws. So do the untyped programs of
 * [`programs.f.js`](./programs.f.js), lowered with no table and linked with
 * the bodies of L1 that they reach into one module, on values of every
 * kind: each answers what JavaScript answers, and where JavaScript throws a
 * `TypeError`, throws L1's value of that error.
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Module } from '../types.ts'
 * @import { _Twin, _Value } from '../wasm/types.ts'
 */

import { readFileSync } from 'node:fs'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import {
    add, at as l1At, bitwiseAnd, call as l1Call, charCodeAt, every, filter, requireObjectCoercible, toIntegerOrInfinity, divide, functionText, get as l1GetFn, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual,
    multiply, negate, number, objectSpread, remainder, shiftRight, strictEquals, stringEquals, stringIndex, stringLess, subtract, toBoolean,
    toIterable, toNumber, toNumeric, toPrimitive, toPropertyKey, toString as l1ToString, typeOf,
} from '../../wasm/runtime/l1/module.f.js'
import { l0 } from '../l0/module.f.js'
import { lifetime } from '../lifetime/module.f.js'
import { native } from '../native/module.f.js'
import { print } from '../print/module.f.js'
import { edges, held, product, run, spellings } from '../wasm/testlib.mjs'
import { keySources, value, withFunction } from '../../wasm/runtime/l1/parity/testlib.mjs'
import * as helpers from './helpers.f.js'
import { errorTable } from './link/module.f.js'
import { lower } from './module.f.js'
import * as sample from './sample.f.js'
import * as strings from './strings.f.js'
import * as constants from './constants.f.js'
import * as literals from './literals.f.js'
import * as arrays from './arrays.f.js'
import * as reads from './reads.f.js'
import * as throws from './throws.f.js'
import * as builds from './builds.f.js'
import * as closures from './closures.f.js'
import * as spreads from './spreads.f.js'
import * as programs from './programs.f.js'
import * as records from './records.f.js'
import {
    arrays as arraySignatures, builds as buildSignatures, constants as constantSignatures, helpers as helperSignatures,
    l1, l1Arith, l1Builders, l1Coerce, l1Get, l1Iterable, l1Runtime, l1Throws, l1Whole, literals as literalSignatures,
    objects as objectSignatures, reads as readSignatures, runtime, signatures, sourceOf, strings as stringSignatures,
    stringsRuntime, throws as throwSignatures, throwsRuntime,
} from './testlib.f.js'

/** The module that the lowering makes of a module's text, read from `url`, for the functions that `table` names, over the runtime `r`. @type {(url: URL, table: Parameters<typeof lower>[0], r?: Parameters<typeof lower>[1]) => Module} */
const fromText = (url, table, r = null) => {
    const { fast, imports } = assertOk(sourceOf(readFileSync(url, 'utf8')))
    return assertOk(lower(table, r)(fast, imports))
}

/** The module that the lowering makes of the sample's text. @type {() => Module} */
const lowered = () => fromText(new URL('./sample.f.js', import.meta.url), signatures)

/** The module that the lowering makes of L1's text, over the runtime. @type {() => Module} */
const fromL1 = () => fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1, runtime)

/** The module that the lowering makes of the helpers' text, over the runtime. @type {() => Module} */
const fromHelpers = () => fromText(new URL('./helpers.f.js', import.meta.url), helperSignatures, runtime)

/** The owned stage of the module that the lowering makes of the string helpers' text, over the runtime: what the lifetime pass writes. @type {() => Module} */
const fromStrings = () => assertOk(lifetime(fromText(new URL('./strings.f.js', import.meta.url), stringSignatures, stringsRuntime)))

/** The owned stage of the module that the lowering makes of the constants' text, over the runtime: what the lifetime pass writes. @type {() => Module} */
const fromConstants = () => assertOk(lifetime(fromText(new URL('./constants.f.js', import.meta.url), constantSignatures, stringsRuntime)))

/** The owned stage of the module that the lowering makes of the literals' text, over the runtime: what the lifetime pass writes. @type {() => Module} */
const fromLiterals = () => assertOk(lifetime(fromText(new URL('./literals.f.js', import.meta.url), literalSignatures, stringsRuntime)))

/** The owned stage of the module that the lowering makes of the arrays' text, over the runtime: what the lifetime pass writes. @type {() => Module} */
const fromArrays = () => assertOk(lifetime(fromText(new URL('./arrays.f.js', import.meta.url), arraySignatures, stringsRuntime)))

/** The owned stage of the module that the lowering makes of the reads' text, over the runtime: what the lifetime pass writes. @type {() => Module} */
const fromReads = () => assertOk(lifetime(fromText(new URL('./reads.f.js', import.meta.url), readSignatures, stringsRuntime)))

/** L1's error table, read from its text. */
const errors = assertOk(errorTable(assertOk(sourceOf(readFileSync(new URL('../../wasm/runtime/l1/error/module.f.js', import.meta.url), 'utf8'))).fast))

/** The owned stage of the module that the lowering makes of the throws' text, over the runtime and L1's error table: what the lifetime pass writes. @type {() => Module} */
const fromThrows = () => assertOk(lifetime(fromText(new URL('./throws.f.js', import.meta.url), throwSignatures, throwsRuntime(errors))))

/** The owned stage of the module that the lowering makes of L1's text for the functions that throw its errors, over the runtime and the table. @type {() => Module} */
const fromL1Throws = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Throws, l1Runtime(errors))))

/** The owned stage of the module that the lowering makes of the builds' text, over the runtime: what the lifetime pass writes. @type {() => Module} */
const fromBuilds = () => assertOk(lifetime(fromText(new URL('./builds.f.js', import.meta.url), buildSignatures, stringsRuntime)))

/** The owned stage of the module that the lowering makes of L1's `toIterable`, over the runtime and the table. @type {() => Module} */
const fromL1Iterable = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Iterable, l1Runtime(errors))))

/** The owned stage of the module that the lowering makes of the objects' text, over the runtime. @type {() => Module} */
const fromObjects = () => assertOk(lifetime(fromText(new URL('./objects.f.js', import.meta.url), objectSignatures, stringsRuntime)))

/** The owned stage of the module that the lowering makes of L1's builders, over the runtime and the table. @type {() => Module} */
const fromL1Builders = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Builders, l1Runtime(errors))))

/** The owned stage of L1's coercions and `call`, over the runtime and the table. @type {() => Module} */
const fromL1Coerce = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Coerce, l1Runtime(errors))))

/** The owned stage of L1's `get`, over the runtime and the table. @type {() => Module} */
const fromL1Get = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Get, l1Runtime(errors))))

/** The owned stage of L1's arithmetic and relational operators, over the runtime and the table. @type {() => Module} */
const fromL1Arith = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Arith, l1Runtime(errors))))

const fromL1Whole = () => assertOk(lifetime(fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Whole, l1Runtime(errors))))

/** The plain stage of every export of L1, which a program links. @type {() => Module} */
const plainL1 = () => fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1Whole, l1Runtime(errors))

/** The owned stage of the programs, which no table types, with the bodies of L1 that they reach linked in. @type {() => Module} */
const fromPrograms = () => assertOk(lifetime(fromText(new URL('./programs.f.js', import.meta.url), {}, { ...l1Runtime(errors), l1: plainL1() })))

/** The programs of the records pass, lowered as the programs are. @type {() => Module} */
const fromRecords = () => assertOk(lifetime(fromText(new URL('./records.f.js', import.meta.url), {}, { ...l1Runtime(errors), l1: plainL1() })))

/** The closures of slice 11b, lowered as the programs are. @type {() => Module} */
const fromClosures = () => assertOk(lifetime(fromText(new URL('./closures.f.js', import.meta.url), {}, { ...l1Runtime(errors), l1: plainL1() })))

/** The spreads and rest parameters of slice 11c, lowered as the programs are. @type {() => Module} */
const fromSpreads = () => assertOk(lifetime(fromText(new URL('./spreads.f.js', import.meta.url), {}, { ...l1Runtime(errors), l1: plainL1() })))

/** Each function of a module, taking its arguments as a list. @type {(m: object) => StringMap<_Twin>} */
const twinsOf = m => Object.fromEntries(Object.entries(m).map(([name, f]) => {
    const g = /** @type {(...xs: readonly _Value[]) => _Value} */ (f)
    return [name, /** @type {_Twin} */ (xs => g(...xs))]
}))

/** `pow` recurses `k` times, so the edges of `f64` do not suit `k`. @type {StringMap<readonly (readonly _Value[])[]>} */
const inputs = { pow: product([edges(['f64']), [0, -0, 1, 2, 10, -1, 0.5, 3.5]]) }

/**
 * `gcd` loops until a remainder is `0`, which a NaN or an infinity never
 * gives, so its inputs are finite: integers of both signs, and fractions
 * that divide each other. `index` reads the bounds of an index beside the
 * edges of `f64`. `steps` counts by `1` to twice its input, so its inputs
 * are small, a fraction and NaN among them.
 *
 * @type {StringMap<readonly (readonly _Value[])[]>}
 */
const helperInputs = {
    gcd: product([[0, -0, 1, 2, 6, 9, 12, -4, 0.5, 1.5, 1e300], [0, 1, 4, 6, -9, 0.25, 1.5]]),
    index: [...edges(['f64']), 4294967294, 4294967295, 4294967296, 4294967295.5, 1.5, -1].map(x => [x]),
    steps: [0, -0, 1, 2.25, 10, -3, -Infinity, NaN].map(x => [x]),
}

/**
 * Values for `strictEquals`: one of each kind, and of each kind two that
 * differ, or that are equal but not the same value, or the same value
 * twice: the two zeros and `NaN`, strings of the same units, bigints of
 * the same value, and arrays, objects and functions, which only the same
 * value equals.
 *
 * @type {readonly _Value[]}
 */
const anyValues = (() => {
    const array = [1]
    const object = { a: 1 }
    /** @type {() => number} */
    const f = () => 1
    return [
        undefined, null, false, true, 0, -0, NaN, 1, '', 'a', 'ab', 'a', 0n, 1n, -1n, 1n << 64n, 1n << 64n,
        array, array, [1], object, object, { a: 1 }, f, f, () => 1,
    ].map(any => ({ any }))
})()

/**
 * An operand of L1's string comparisons: a string of each length up to
 * three, two with a common prefix, units at both ends of their range, a
 * surrogate pair, which compares by its units, and half of one, or a value
 * of another kind, which neither takes.
 *
 * @type {readonly _Value[]}
 */
const operands = ['', 'a', 'b', 'ab', 'ba', 'abc', 'abd', '\u0000', '\uffff', '\ud83d\ude00', 'a\ud83d', 1, null, ['a']].map(any => ({ any }))

/** Every pair of operands, for both string comparisons. */
const pairs = product([operands, operands])

/** A float that a twin gets. @type {(v: _Value) => number} */
const float64 = v => {
    assert(typeof v === 'number', v)
    return v
}

/** The functions that read constants, on values as the host holds them: a value of `any` is a handle. @type {StringMap<_Twin>} */
const constantTwins = {
    scale: ([x]) => constants.scale(float64(x)),
    twice: ([x]) => constants.twice(float64(x)),
    shift: ([x]) => constants.shift(float64(x)),
    narrow: ([x]) => constants.narrow(float64(x)),
    dashed: ([v]) => ({ any: constants.dashed(held(v)) }),
    numberOrUndefined: ([v]) => ({ any: constants.numberOrUndefined(held(v)) }),
}

/** The functions that read string literals, on values as the host holds them. @type {StringMap<_Twin>} */
const literalTwins = {
    greet: ([v]) => ({ any: literals.greet(held(v)) }),
    empty: () => ({ any: literals.empty() }),
    units: () => literals.units(),
    surrogate: ([i]) => literals.surrogate(float64(i)),
    hello: ([s]) => ({ any: literals.hello(held(s)) }),
}

/** The twins of the builds, on the values that values of `any` hold. @type {StringMap<_Twin>} */
const buildTwins = {
    units: ([s]) => ({ any: builds.units(held(s)) }),
    repeated: ([v, n]) => ({ any: builds.repeated(held(v), float64(n)) }),
    rows: ([v]) => ({ any: builds.rows(held(v)) }),
    backwards: ([s]) => ({ any: builds.backwards(held(s)) }),
    step: ([s]) => builds.step(float64(s)),
    at: ([v, s]) => ({ any: builds.at(held(v), float64(s)) }),
    ordered: ([v]) => ({ any: builds.ordered(held(v)) }),
    stepped: ([v]) => ({ any: builds.stepped(held(v)) }),
}

/** Strings, and a value of each other kind. @type {readonly (readonly _Value[])[]} */
const iterables = [...['', 'a', 'ab', '\uD83D\uDE00', 'a\uD83D\uDE00b', '\uD800', '\uDC00a', '\uD800\uD800'], [], ['x', 'y'], {}, 1, 0n, undefined, null, true]
    .map(any => [{ any }])

/** The functions that make arrays, on values as the host holds them. @type {StringMap<_Twin>} */
const arrayTwins = {
    none: () => ({ any: arrays.none() }),
    pair: ([a, b]) => ({ any: arrays.pair(held(a), held(b)) }),
    nested: ([v]) => ({ any: arrays.nested(held(v)) }),
    counted: ([s]) => arrays.counted(held(s)),
    second: ([a, b]) => ({ any: arrays.second(held(a), held(b)) }),
    both: () => ({ any: arrays.both() }),
}

/** The reads, on values as the host holds them: a value of `any` is a handle. @type {StringMap<_Twin>} */
const readTwins = {
    pick: ([a, b, k]) => ({ any: reads.pick(held(a), held(b), float64(k)) }),
    only: ([a]) => ({ any: reads.only(held(a)) }),
    letter: ([k]) => ({ any: reads.letter(float64(k)) }),
    inner: ([a, k]) => ({ any: reads.inner(held(a), float64(k)) }),
}

/** The throws, on values as the host holds them: each throws what its original throws. @type {StringMap<_Twin>} */
const throwTwins = {
    textLength: ([v]) => throws.textLength(held(v)),
    rethrow: ([v]) => ({ any: throws.rethrow(held(v)) }),
    bigints: ([a, b]) => throws.bigints(held(a), held(b)),
    sign: ([x]) => throws.sign(float64(x)),
}

/** The string helpers, on values as the host holds them: a value of `any` is a handle. @type {StringMap<_Twin>} */
const stringTwins = {
    pair: ([a, b]) => ({ any: strings.pair(float64(a), float64(b)) }),
    twice: ([s]) => ({ any: strings.twice(held(s)) }),
    inner: ([s]) => ({ any: strings.inner(held(s)) }),
    trimStart: ([s]) => ({ any: strings.trimStart(held(s)) }),
    lastOfTwice: ([s]) => strings.lastOfTwice(held(s)),
    first: ([v]) => ({ any: strings.first(held(v)) }),
}

/**
 * Inputs of the string helpers: units at both ends of their range, past
 * them and between two integers; strings of each length up to four, a
 * surrogate half, and spaces at either end and between; arrays and objects
 * of a string, of a container and of nothing; and values of the kinds that
 * the helpers do not take.
 *
 * @type {StringMap<readonly (readonly _Value[])[]>}
 */
const stringInputs = (() => {
    const texts = ['', 'a', 'ab', 'abc', 'abcd', '\ud83d', ' ', '  ', ' a', '  a b ', 'a  ']
    const others = [undefined, null, true, 0, NaN, 1n, ['a'], { a: 'x' }, () => 0]
    const of = (/** @type {readonly unknown[]} */ xs) => xs.map(any => [{ any }])
    const containers = [[], ['x', 2], [[3]], {}, { a: 'x' }, { a: { b: 1 } }]
    return {
        pair: product([[0x61, 0, -0, 0xffff, 0x1_0000, -1, 0.5, NaN, Infinity], [0x62, 0xd83d]]),
        twice: of([...texts, ...others]),
        inner: of([...texts, ...others]),
        trimStart: of([...texts, ...others]),
        lastOfTwice: of([...texts, ...others]),
        first: of([...containers, ...texts, ...others]),
    }
})()

/**
 * Runs a program's exports against their originals on the values of the
 * parity table, an object of a nested object, one of a function and a
 * function of two arguments; `abandons` names the exports that may leave
 * what they made for a throw of L1 behind.
 *
 * @type {(m: Module, originals: object, abandons: readonly string[]) => void}
 */
const runPrograms = (m, originals, abandons) => {
    /** @type {(f: (...xs: readonly unknown[]) => unknown) => _Twin} */
    const boxed = f => xs => ({ any: f(...xs.map(held)) })
    const values = [
        ...withFunction.map(value),
        { a: { b: 1 } },
        { f: (/** @type {unknown} */ x) => x },
        (/** @type {unknown} */ a, /** @type {unknown} */ b) => [a, b],
    ]
    const few = values.filter((_, k) => k % 4 === 0)
    /** @type {StringMap<_Twin>} */
    const twins = Object.fromEntries(Object.entries(originals).map(([k, f]) => [k, boxed(/** @type {(...xs: readonly unknown[]) => unknown} */ (f))]))
    /** @type {(f: Function) => readonly (readonly _Value[])[]} */
    const rows = f => f.length === 0 ? [[]] : f.length === 1 ? values.map(any => [{ any }])
        : f.length === 2 ? values.flatMap(a => values.map(b => [{ any: a }, { any: b }]))
        : values.flatMap(a => few.flatMap(b => few.map(c => [{ any: a }, { any: b }, { any: c }])))
    run(m, twins, Object.fromEntries(Object.entries(originals).map(([k, f]) => [k, rows(f)])), abandons)
}

export const proof = {
    ir: () => assertEq(print(lowered()), [
        'fn atLeast(a: f64, b: f64) -> bool =',
        '    le(b, a)',
        '',
        'fn average(a: u(32), b: u(32)) -> f64 =',
        '    div(float(add(a, b)), 2.0)',
        '',
        'fn both(a: bool, b: bool) -> bool =',
        '    if a then b else a',
        '',
        'fn clamp(x: i(32), lo: i(32), hi: i(32)) -> i(32) =',
        '    if lt(x, lo) then lo else if lt(hi, x) then hi else x',
        '',
        'fn delta(a: u(16), b: u(16)) -> i(17) =',
        '    sub(a, b)',
        '',
        'fn differ(a: bool, b: bool) -> bool =',
        '    if a',
        '    then',
        '        if b then false else true',
        '    else',
        '        b',
        '',
        'fn distance(x: f64, y: f64, p: f64, q: f64) -> f64 =',
        '    hypot(sub(p, x), sub(q, y))',
        '',
        'fn early(a: f64, b: f64) -> f64 =',
        '    if lt(a, 0.0)',
        '    then',
        '        0.0',
        '    else',
        '        sub(',
        '            let #0 = mul(a, b)',
        '            add(#0, #0),',
        '            a',
        '        )',
        '',
        'fn either(a: bool, b: bool) -> bool =',
        '    if a then a else b',
        '',
        'fn greater(a: f64, b: f64) -> bool =',
        '    lt(b, a)',
        '',
        'fn hypot(a: f64, b: f64) -> f64 =',
        '    sqrt(add(mul(a, a), mul(b, b)))',
        '',
        'fn lessU64(a: u(64), b: u(64)) -> bool =',
        '    lt(a, b)',
        '',
        'fn magnitude(x: f64) -> f64 =',
        '    abs(neg(x))',
        '',
        'fn max(a: f64, b: f64) -> f64 =',
        '    if lt(a, b) then b else a',
        '',
        'fn negate(x: f64) -> f64 =',
        '    neg(x)',
        '',
        'fn notEqual(a: i(64), b: i(64)) -> bool =',
        '    if eq(a, b) then false else true',
        '',
        'fn opposite(x: i(32)) -> int(-2147483647, 2147483648) =',
        '    sub(0, x)',
        '',
        'fn pow(x: f64, k: f64) -> f64 =',
        '    if le(k, 0.0) then 1.0 else mul(x, pow(x, sub(k, 1.0)))',
        '',
        'fn product(a: u(32), b: u(32)) -> u(64) =',
        '    mul(a, b)',
        '',
        'fn safeDiv(a: f64, b: f64) -> f64 =',
        '    if eq(b, 0.0) then 0.0 else div(a, b)',
        '',
        'fn same(a: i(32), b: u(32)) -> bool =',
        '    eq(a, b)',
        '',
        'fn sameBool(a: bool, b: bool) -> bool =',
        '    if a then b else if b then false else true',
        '',
        'fn sign(x: i(32)) -> int(-1, 1) =',
        '    if lt(x, 0) then -1 else if eq(x, 0) then 0 else 1',
        '',
        'fn square(a: f64, b: f64) -> f64 =',
        '    let #0 = add(a, b)',
        '    mul(#0, #0)',
        '',
        'fn sum(a: u(32), b: u(32)) -> u(33) =',
        '    add(a, b)',
        '',
        'fn xor(a: bool, b: bool) -> bool =',
        '    if a',
        '    then',
        '        if b then false else true',
        '    else',
        '        b',
        '',
        'export atLeast, average, both, clamp, delta, differ, distance, early, either, greater, hypot, lessU64, magnitude, max, negate, notEqual, opposite, pow, product, safeDiv, same, sameBool, sign, square, sum, xor',
        '',
    ].join('\n')),
    run: () => run(lowered(), twinsOf(sample), inputs),
    l1: () => assertEq(print(fromL1()), [
        "import Any from fjs:l0",
        "    type any = undefined | null | boolean | number | string | bigint | array | object | function",
        "        kind: kind, carrier: i64, dup: dup, drop: drop, copy: undefined | null | boolean, literal: string by String.make_string",
        "    const undefined: any.only(undefined)",
        "    const null: any.only(null)",
        "    const true: any.only(boolean)",
        "    const false: any.only(boolean)",
        "    fn kind(v: any) -> int(0, 8)",
        "    fn to_f64(v: any.only(number)) -> f64c",
        "    fn from_f64(x: f64) -> any.only(number)",
        "    fn to_bool(v: any.only(boolean)) -> bool",
        "    fn from_bool(b: bool) -> any.only(boolean)",
        "    fn same(a: any.only(array, object, function), b: any.only(array, object, function)) -> bool",
        "    fn dup(v: any) -> any",
        "    fn drop(own v: any) -> unit",
        "",
        "import String from fjs:l0",
        "    fn length(s: any.only(string)) -> u(31)",
        "    fn unit(s: any.only(string), i: u(31)) -> u(16) may fail",
        "    fn from_unit(c: u(16)) -> any.only(string)",
        "    fn concat(a: any.only(string), b: any.only(string)) -> any.only(string)",
        "    fn substring(s: any.only(string), start: u(31), end: u(31)) -> any.only(string) may fail",
        "",
        "import BigInt from fjs:l0",
        "    fn length(b: any.only(bigint)) -> u(31)",
        "",
        "import Containers from fjs:l0",
        "    type builder = builder",
        "        carrier: i32",
        "    fn length(c: any.only(array, object)) -> u(31)",
        "    fn item(c: any.only(array, object), i: u(31)) -> any may fail",
        "    fn find(o: any.only(object), k: any.only(string)) -> i(32)",
        "    fn begin_array(n: u(31)) -> builder",
        "    fn begin_object(n: u(31)) -> builder",
        "    fn push(own b: builder, own v: any) -> builder, gives back b may fail",
        "    fn push_all(own b: builder, a: any.only(array)) -> builder, gives back b may fail",
        "    fn push_property(own b: builder, own k: any.only(string), own v: any) -> builder, gives back b may fail",
        "    fn seal(own b: builder) -> any.only(array, object) may fail",
        "    fn join(parts: any.only(array), separator: any.only(string)) -> any.only(string) may fail",
        "    fn key(o: any.only(object), i: u(31)) -> any.only(string) may fail",
        "",
        "import Functions from fjs:l0",
        "    fn length(f: any.only(function)) -> u(31)",
        "    fn make_function(c: code([any.only(function), any.only(array)], any), own frame: any.only(array), length: u(31), own text: any.only(string, undefined)) -> any.only(function)",
        "    fn call(f: any.only(function), args: any.only(array)) -> any may fail",
        "    fn text(f: any.only(function)) -> any.only(string, undefined)",
        "    fn throw(own v: any) -> never may fail",
        "    fn frame(self: any.only(function), i: u(31)) -> any may fail",
        "",
        "import Native from fjs:l1-native",
        "    fn bigintEquals(a: any.only(bigint), b: any.only(bigint)) -> bool",
        "    fn numberRemainder(a: f64, b: f64) -> f64",
        "    fn numberShiftRight(a: f64, b: f64) -> f64",
        "    fn numberAnd(a: f64, b: f64) -> f64",
        "    fn numberToString(n: f64) -> any.only(string)",
        "    fn stringToNumber(s: any.only(string)) -> f64",
        "    fn stringToBigInt(s: any.only(string)) -> any.only(bigint) may fail",
        "    fn bigintToString(b: any.only(bigint)) -> any.only(string)",
        "    fn bigintAdd(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintSubtract(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintMultiply(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintDivide(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintNegate(a: any.only(bigint)) -> any.only(bigint)",
        "    fn bigintRemainder(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintShiftRight(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintAnd(a: any.only(bigint), b: any.only(bigint)) -> any.only(bigint) may fail",
        "    fn bigintToNumber(b: any.only(bigint)) -> f64",
        "    fn bigintLess(a: any, b: any) -> f64",
        "",
        "const #c0: any.only(array) =",
        "    match Containers.seal(Containers.push(Containers.push(Containers.push(Containers.push(Containers.push(Containers.push(Containers.push(Containers.push(Containers.push(Containers.begin_array(9), \"undefined\"), \"object\"), \"boolean\"), \"number\"), \"string\"), \"bigint\"), \"object\"), \"object\"), \"function\"))",
        "      array as array =>",
        "        array",
        "      else =>",
        "        trap('not array')",
        "",
        "fn strictEquals(a: any, b: any) -> bool =",
        "    let #0 = float(Any.kind(a))",
        "    if if eq(#0, float(Any.kind(b))) then false else true",
        "    then",
        "        false",
        "    else",
        "        if eq(#0, 2.0)",
        "        then",
        "            if",
        "                match a",
        "                  boolean as a.boolean =>",
        "                    Any.to_bool(a.boolean)",
        "                  else =>",
        "                    trap('not boolean')",
        "            then",
        "                match b",
        "                  boolean as b.boolean =>",
        "                    Any.to_bool(b.boolean)",
        "                  else =>",
        "                    trap('not boolean')",
        "            else",
        "                if",
        "                    match b",
        "                      boolean as b.boolean =>",
        "                        Any.to_bool(b.boolean)",
        "                      else =>",
        "                        trap('not boolean')",
        "                then",
        "                    false",
        "                else",
        "                    true",
        "        else",
        "            if eq(#0, 3.0)",
        "            then",
        "                eq(",
        "                    match a",
        "                      number as a.number =>",
        "                        Any.to_f64(a.number)",
        "                      else =>",
        "                        trap('not number'),",
        "                    match b",
        "                      number as b.number =>",
        "                        Any.to_f64(b.number)",
        "                      else =>",
        "                        trap('not number')",
        "                )",
        "            else",
        "                if eq(#0, 4.0)",
        "                then",
        "                    stringEquals(a, b)",
        "                else",
        "                    if eq(#0, 5.0)",
        "                    then",
        "                        match a",
        "                          bigint as a.bigint =>",
        "                            match b",
        "                              bigint as b.bigint =>",
        "                                Native.bigintEquals(a.bigint, b.bigint)",
        "                              else =>",
        "                                trap('not bigint')",
        "                          else =>",
        "                            trap('not bigint')",
        "                    else",
        "                        if",
        "                            let #1 = eq(#0, 6.0)",
        "                            let #2 = if #1 then #1 else eq(#0, 7.0)",
        "                            if #2 then #2 else eq(#0, 8.0)",
        "                        then",
        "                            match a",
        "                              array | object | function as a.same =>",
        "                                match b",
        "                                  array | object | function as b.same =>",
        "                                    Any.same(a.same, b.same)",
        "                                  else =>",
        "                                    trap('not array or object or function')",
        "                              else =>",
        "                                trap('not array or object or function')",
        "                        else",
        "                            true",
        "",
        "fn stringEquals(a: any, b: any) -> bool =",
        "    match a",
        "      string as a.string =>",
        "        let #0 = float(String.length(a.string))",
        "        match b",
        "          string as b.string =>",
        "            if if eq(#0, float(String.length(b.string))) then false else true",
        "            then",
        "                false",
        "            else",
        "                eq(",
        "                    loop L0 (#1: f64 = 0.0)",
        "                        if",
        "                            let #2 = lt(#1, #0)",
        "                            if #2",
        "                            then",
        "                                eq(",
        "                                    float(",
        "                                        let #1.index = trunc_sat(u(31), #1)",
        "                                        if eq(float(#1.index), #1) then String.unit(a.string, #1.index) else trap('inexact')",
        "                                    ),",
        "                                    float(",
        "                                        let #1.index = trunc_sat(u(31), #1)",
        "                                        if eq(float(#1.index), #1) then String.unit(b.string, #1.index) else trap('inexact')",
        "                                    )",
        "                                )",
        "                            else",
        "                                #2",
        "                        then",
        "                            br L0 { #1: add(#1, 1.0) }",
        "                        else",
        "                            #1,",
        "                    #0",
        "                )",
        "          else =>",
        "            trap('not string')",
        "      else =>",
        "        trap('not string')",
        "",
        "fn stringIndex(s: any) -> f64 =",
        "    let #0 =",
        "        float(",
        "            match s",
        "              string as s.string =>",
        "                String.length(s.string)",
        "              bigint as s.bigint =>",
        "                BigInt.length(s.bigint)",
        "              array | object as s.containers =>",
        "                Containers.length(s.containers)",
        "              function as s.functions =>",
        "                Functions.length(s.functions)",
        "              undefined | null | boolean | number =>",
        "                trap('no length')",
        "        )",
        "    if",
        "        let #1 = eq(#0, 0.0)",
        "        if #1",
        "        then",
        "            #1",
        "        else",
        "            let #2 = lt(1.0, #0)",
        "            if #2",
        "            then",
        "                eq(",
        "                    float(",
        "                        match s",
        "                          string as s.string =>",
        "                            let unit.index = trunc_sat(u(31), 0.0)",
        "                            if eq(float(unit.index), 0.0) then String.unit(s.string, unit.index) else trap('inexact')",
        "                          else =>",
        "                            trap('not string')",
        "                    ),",
        "                    48.0",
        "                )",
        "            else",
        "                #2",
        "    then",
        "        -1.0",
        "    else",
        "        (",
        "            loop L0 (#1: { i: f64, value: f64 } = { i: 0.0, value: 0.0 })",
        "                if",
        "                    let #2 = lt(#1.i, #0)",
        "                    if #2 then le(0.0, #1.value) else #2",
        "                then",
        "                    let #2 =",
        "                        let #2 =",
        "                            float(",
        "                                match s",
        "                                  string as s.string =>",
        "                                    let unit.index.float = #1.i",
        "                                    let unit.index = trunc_sat(u(31), unit.index.float)",
        "                                    if eq(float(unit.index), unit.index.float) then String.unit(s.string, unit.index) else trap('inexact')",
        "                                  else =>",
        "                                    trap('not string')",
        "                            )",
        "                        if",
        "                            let #3 = le(48.0, #2)",
        "                            if #3 then le(#2, 57.0) else #3",
        "                        then",
        "                            sub(#2, 48.0)",
        "                        else",
        "                            -1.0",
        "                    let #3 = if lt(#2, 0.0) then -1.0 else add(mul(#1.value, 10.0), #2)",
        "                    br L0 { #1: { i: add(#1.i, 1.0), value: if lt(4294967295.0, #3) then -1.0 else #3 } }",
        "                else",
        "                    #1",
        "        ).value",
        "",
        "fn stringLess(a: any, b: any) -> bool =",
        "    match a",
        "      string as a.string =>",
        "        let #0 = float(String.length(a.string))",
        "        match b",
        "          string as b.string =>",
        "            let #1 = float(String.length(b.string))",
        "            let #2 =",
        "                loop L0 (#2: f64 = 0.0)",
        "                    if",
        "                        let #3 = lt(#2, #0)",
        "                        let #4 = if #3 then lt(#2, #1) else #3",
        "                        if #4",
        "                        then",
        "                            eq(",
        "                                float(",
        "                                    let #2.index = trunc_sat(u(31), #2)",
        "                                    if eq(float(#2.index), #2) then String.unit(a.string, #2.index) else trap('inexact')",
        "                                ),",
        "                                float(",
        "                                    let #2.index = trunc_sat(u(31), #2)",
        "                                    if eq(float(#2.index), #2) then String.unit(b.string, #2.index) else trap('inexact')",
        "                                )",
        "                            )",
        "                        else",
        "                            #4",
        "                    then",
        "                        br L0 { #2: add(#2, 1.0) }",
        "                    else",
        "                        #2",
        "            if",
        "                let #3 = lt(#2, #0)",
        "                if #3 then lt(#2, #1) else #3",
        "            then",
        "                lt(",
        "                    float(",
        "                        let #2.index = trunc_sat(u(31), #2)",
        "                        if eq(float(#2.index), #2) then String.unit(a.string, #2.index) else trap('inexact')",
        "                    ),",
        "                    float(",
        "                        let #2.index = trunc_sat(u(31), #2)",
        "                        if eq(float(#2.index), #2) then String.unit(b.string, #2.index) else trap('inexact')",
        "                    )",
        "                )",
        "            else",
        "                lt(#0, #1)",
        "          else =>",
        "            trap('not string')",
        "      else =>",
        "        trap('not string')",
        "",
        "fn toBoolean(v: any) -> bool =",
        "    let #0 = float(Any.kind(v))",
        "    if eq(#0, 2.0)",
        "    then",
        "        match v",
        "          boolean as v.boolean =>",
        "            Any.to_bool(v.boolean)",
        "          else =>",
        "            trap('not boolean')",
        "    else",
        "        if eq(#0, 3.0)",
        "        then",
        "            match v",
        "              number as v.number =>",
        "                let #1 = Any.to_f64(v.number)",
        "                let #2 = eq(#1, #1)",
        "                if #2",
        "                then",
        "                    if eq(#1, 0.0) then false else true",
        "                else",
        "                    #2",
        "              else =>",
        "                trap('not number')",
        "        else",
        "            if",
        "                let #1 = eq(#0, 4.0)",
        "                if #1 then #1 else eq(#0, 5.0)",
        "            then",
        "                if",
        "                    eq(",
        "                        float(",
        "                            match v",
        "                              string as v.string =>",
        "                                String.length(v.string)",
        "                              bigint as v.bigint =>",
        "                                BigInt.length(v.bigint)",
        "                              array | object as v.containers =>",
        "                                Containers.length(v.containers)",
        "                              function as v.functions =>",
        "                                Functions.length(v.functions)",
        "                              undefined | null | boolean | number =>",
        "                                trap('no length')",
        "                        ),",
        "                        0.0",
        "                    )",
        "                then",
        "                    false",
        "                else",
        "                    true",
        "            else",
        "                let #1 = eq(#0, 6.0)",
        "                let #2 = if #1 then #1 else eq(#0, 7.0)",
        "                if #2 then #2 else eq(#0, 8.0)",
        "",
        "fn typeOf(v: any) -> any =",
        "    let #0 = float(Any.kind(v))",
        "    let array.index = trunc_sat(u(31), #0)",
        "    if eq(float(array.index), #0)",
        "    then",
        "        if lt(array.index, Containers.length(self.#c0)) then Containers.item(self.#c0, array.index) else Any.undefined",
        "    else",
        "        Any.undefined",
        "",
        "export strictEquals, stringEquals, stringIndex, stringLess, toBoolean, typeOf",
        "",
    ].join('\n')),
    helpers: () => {
        const m = fromHelpers()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            'fn doubleBoth(a: u(8), b: u(16)) -> i(18) =',
            '    sub(add(a, a), add(b, b))',
            '',
            'fn gcd(a: f64, b: f64) -> f64 =',
            '    (',
            '        loop L0 (#0: { x: f64, y: f64 } = { x: a, y: b })',
            '            if if eq(#0.y, 0.0) then false else true then br L0 { #0: { x: #0.y, y: Native.numberRemainder(#0.x, #0.y) } } else #0',
            '    ).x',
            '',
            'fn index(n: f64) -> f64 =',
            '    if',
            '        let #0 = eq(Native.numberRemainder(n, 1.0), 0.0)',
            '        let #1 = if #0 then le(0.0, n) else #0',
            '        if #1 then le(n, 4294967295.0) else #1',
            '    then',
            '        n',
            '    else',
            '        -1.0',
            '',
            'fn meanOfSquare(a: f64, b: f64) -> f64 =',
            '    let #0 = add(a, 1.0)',
            '    let #1 =',
            '        let #1 = add(b, 1.0)',
            '        mul(#1, #1)',
            '    div(add(#0, #1), 2.0)',
            '',
            'fn middle(a: f64, b: f64, c: f64, d: f64) -> f64 =',
            '    let #0 = { x: div(add(a, c), 2.0), y: div(add(b, d), 2.0) }',
            '    mul(#0.x, #0.y)',
            '',
            'fn mod3(a: f64) -> f64 =',
            '    remainder(a, 3.0)',
            '',
            'fn quadruple(x: f64) -> f64 =',
            '    sub(',
            '        let #0 = add(x, x)',
            '        add(#0, #0),',
            '        x',
            '    )',
            '',
            'fn remainder(a: f64, b: f64) -> f64 =',
            '    Native.numberRemainder(a, b)',
            '',
            'fn steps(a: f64) -> f64 =',
            '    let #0 = mul(a, 2.0)',
            '    loop L0 (#1: f64 = 0.0)',
            '        if lt(#1, #0) then br L0 { #1: add(#1, 1.0) } else #1',
            '',
            'fn sumOfTwice(a: f64, b: f64) -> f64 =',
            '    add(',
            '        add(a, a),',
            '        let #0 = add(b, 1.0)',
            '        add(#0, #0)',
            '    )',
            '',
            'export doubleBoth, gcd, index, meanOfSquare, middle, mod3, quadruple, remainder, steps, sumOfTwice',
            '',
        ].join('\n'))
    },
    helpersRun: () => run(fromHelpers(), twinsOf(helpers), helperInputs),
    strings: () => {
        const m = fromStrings()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            'fn first(v: any) -> any =',
            '    if',
            '        let #0 = float(Any.kind(v))',
            '        let #1 = eq(#0, 6.0)',
            '        let #2 = if #1 then #1 else eq(#0, 7.0)',
            '        if #2',
            '        then',
            '            let #3 =',
            '                float(',
            '                    match v',
            '                      string as v.string =>',
            '                        String.length(v.string)',
            '                      bigint as v.bigint =>',
            '                        BigInt.length(v.bigint)',
            '                      array | object as v.containers =>',
            '                        Containers.length(v.containers)',
            '                      function as v.functions =>',
            '                        Functions.length(v.functions)',
            '                      undefined | null | boolean | number =>',
            "                        trap('no length')",
            '                )',
            '            lt(0.0, #3)',
            '        else',
            '            #2',
            '    then',
            '        match v',
            '          array | object as v.item =>',
            '            let v.index = trunc_sat(u(31), 0.0)',
            "            if eq(float(v.index), 0.0) then Containers.item(v.item, v.index) else trap('inexact')",
            '          else =>',
            "            trap('not array or object')",
            '    else',
            '        Any.dup(v)',
            '',
            'fn inner(s: any) -> any.only(string) =',
            '    let #0 =',
            '        sub(',
            '            float(',
            '                match s',
            '                  string as s.string =>',
            '                    String.length(s.string)',
            '                  bigint as s.bigint =>',
            '                    BigInt.length(s.bigint)',
            '                  array | object as s.containers =>',
            '                    Containers.length(s.containers)',
            '                  function as s.functions =>',
            '                    Functions.length(s.functions)',
            '                  undefined | null | boolean | number =>',
            "                    trap('no length')",
            '            ),',
            '            1.0',
            '        )',
            '    match s',
            '      string as s.string =>',
            '        let s.end = trunc_sat(u(31), #0)',
            '        if eq(float(s.end), #0)',
            '        then',
            '            let s.start = trunc_sat(u(31), 1.0)',
            "            if eq(float(s.start), 1.0) then String.substring(s.string, s.start, s.end) else trap('inexact')",
            '        else',
            "            trap('inexact')",
            '      else =>',
            "        trap('not string')",
            '',
            'fn lastOfTwice(s: any) -> f64 =',
            '    let #0 =',
            '        match s',
            '          string as s.string =>',
            '            String.concat(s.string, s.string)',
            '          else =>',
            "            trap('not string')",
            '    let $0 =',
            '        if eq(float(String.length(#0)), 0.0)',
            '        then',
            '            -1.0',
            '        else',
            '            add(',
            '                let #1 = sub(float(String.length(#0)), 1.0)',
            '                float(',
            '                    let #1.index = trunc_sat(u(31), #1)',
            "                    if eq(float(#1.index), #1) then String.unit(#0, #1.index) else trap('inexact')",
            '                ),',
            '                float(String.length(#0))',
            '            )',
            '    let $1 = Any.drop(#0)',
            '    $0',
            '',
            'fn pair(a: f64, b: f64) -> any.only(string) =',
            '    let #0 =',
            '        let a.unit = trunc_sat(u(16), a)',
            "        if eq(float(a.unit), a) then String.from_unit(a.unit) else trap('inexact')",
            '    let $2 =',
            '        let #1 =',
            '            let b.unit = trunc_sat(u(16), b)',
            "            if eq(float(b.unit), b) then String.from_unit(b.unit) else trap('inexact')",
            '        let $0 = String.concat(#0, #1)',
            '        let $1 = Any.drop(#1)',
            '        $0',
            '    let $3 = Any.drop(#0)',
            '    $2',
            '',
            'fn trimStart(s: any) -> any.only(string) =',
            '    let #0 =',
            '        match s',
            '          string as s.string =>',
            '            Any.dup(s.string)',
            '          else =>',
            "            trap('not string')",
            '    loop L0 (#1: any.only(string) = #0)',
            '        if',
            '            let #2 =',
            '                let #2 = float(String.length(#1))',
            '                lt(0.0, #2)',
            '            if #2',
            '            then',
            '                eq(',
            '                    float(',
            '                        let unit.index = trunc_sat(u(31), 0.0)',
            "                        if eq(float(unit.index), 0.0) then String.unit(#1, unit.index) else trap('inexact')",
            '                    ),',
            '                    32.0',
            '                )',
            '            else',
            '                #2',
            '        then',
            '            let $0 =',
            '                let #2 = float(String.length(#1))',
            '                let #1.end = trunc_sat(u(31), #2)',
            '                if eq(float(#1.end), #2)',
            '                then',
            '                    let #1.start = trunc_sat(u(31), 1.0)',
            "                    if eq(float(#1.start), 1.0) then String.substring(#1, #1.start, #1.end) else trap('inexact')",
            '                else',
            "                    trap('inexact')",
            '            let $1 = Any.drop(#1)',
            '            br L0 { #1: $0 }',
            '        else',
            '            #1',
            '',
            'fn twice(s: any) -> any.only(string) =',
            '    match s',
            '      string as s.string =>',
            '        String.concat(s.string, s.string)',
            '      else =>',
            "        trap('not string')",
            '',
            'export first, inner, lastOfTwice, pair, trimStart, twice',
            '',
        ].join('\n'))
    },
    stringsRun: () => run(fromStrings(), stringTwins, stringInputs),
    // The constants' owned stage: each constant owns its value, and a function that answers one answers a dup of it.
    constants: () => {
        const m = fromConstants()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            'const #c0: f64 =',
            '    div(1.0, 2.0)',
            '',
            'const #c1: f64 =',
            '    mul(self.#c0, self.#c0)',
            '',
            'const #c2: f64 =',
            '    twice(2.0)',
            '',
            'const #c3: f64 =',
            '    mul(mul(2.0, 2.0), 2.0)',
            '',
            'const #c4: bool =',
            '    lt(self.#c1, self.#c0)',
            '',
            'const #c5: any.only(string) =',
            '    let fromUnit.unit = trunc_sat(u(16), 45.0)',
            "    if eq(float(fromUnit.unit), 45.0) then String.from_unit(fromUnit.unit) else trap('inexact')",
            '',
            'const #c6: any.only(string) =',
            '    String.concat(self.#c5, self.#c5)',
            '',
            'fn dashed(v: any) -> any =',
            '    if eq(float(Any.kind(v)), 4.0)',
            '    then',
            '        let #0 =',
            '            match v',
            '              string as v.string =>',
            '                String.concat(self.#c6, v.string)',
            '              else =>',
            "                trap('not string')",
            '        let $0 = String.concat(#0, self.#c6)',
            '        let $1 = Any.drop(#0)',
            '        $0',
            '    else',
            '        Any.dup(self.#c5)',
            '',
            'fn narrow(x: f64) -> f64 =',
            '    if self.#c4 then mul(x, self.#c0) else x',
            '',
            'fn numberOrUndefined(v: any) -> any =',
            '    if eq(float(Any.kind(v)), 3.0) then Any.dup(v) else Any.undefined',
            '',
            'fn scale(x: f64) -> f64 =',
            '    add(mul(x, self.#c1), self.#c0)',
            '',
            'fn shift(x: f64) -> f64 =',
            '    sub(add(x, self.#c2), self.#c3)',
            '',
            'fn twice(x: f64) -> f64 =',
            '    add(x, x)',
            '',
            'export dashed, narrow, numberOrUndefined, scale, shift, twice',
            '',
        ].join('\n'))
    },
    // Each call comes after `init`, on cells that the host then keeps, the constants' among them, and leaves them as it found them.
    constantsRun: () => run(fromConstants(), constantTwins, {}),
    // A string literal is a borrow: a function that answers one answers a dup of it.
    literals: () => {
        const m = fromLiterals()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            'fn empty() -> any.only(string) =',
            '    Any.dup("")',
            '',
            'fn greet(v: any) -> any =',
            '    if eq(float(Any.kind(v)), 4.0)',
            '    then',
            '        let #0 = String.concat("hello", ", ")',
            '        let $0 =',
            '            match v',
            '              string as v.string =>',
            '                String.concat(#0, v.string)',
            '              else =>',
            "                trap('not string')",
            '        let $1 = Any.drop(#0)',
            '        $0',
            '    else',
            '        Any.dup("hello")',
            '',
            'fn hello(s: any) -> any.only(string) =',
            '    match s',
            '      string as s.string =>',
            '        String.concat("hello", s.string)',
            '      else =>',
            "        trap('not string')",
            '',
            'fn surrogate(i: f64) -> f64 =',
            '    float(',
            '        let i.index = trunc_sat(u(31), i)',
            '        if eq(float(i.index), i) then String.unit("😀", i.index) else trap(\'inexact\')',
            '    )',
            '',
            'fn units() -> f64 =',
            '    add(float(String.length("café")), float(String.length("😀")))',
            '',
            'export empty, greet, hello, surrogate, units',
            '',
        ].join('\n'))
    },
    // The start function makes the literals, which the host then keeps, and each call leaves the cells as it found them.
    literalsRun: () => run(fromLiterals(), literalTwins, {}),
    // An array is built once its items are values, and an item that a module's array or a call holds is a count of its own.
    arrays: () => {
        const m = fromArrays()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            "const #c0: any.only(array) =",
            "    let $0 = Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), Any.dup(\"a\")), Any.dup(\"b\")))",
            "    let $1 =",
            "        match $0",
            "          array as array =>",
            "            Any.dup(array)",
            "          else =>",
            "            trap('not array')",
            "    let $2 = Any.drop($0)",
            "    $1",
            "",
            "fn both() -> any =",
            "    Any.dup(self.#c0)",
            "",
            "fn counted(s: any) -> f64 =",
            "    float(",
            "        let $1 =",
            "            let #0 =",
            "                match s",
            "                  string as s.string =>",
            "                    String.concat(s.string, s.string)",
            "                  else =>",
            "                    trap('not string')",
            "            let $0 = Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), Any.dup(s)), #0))",
            "            let $2 =",
            "                match $0",
            "                  array as array =>",
            "                    Any.dup(array)",
            "                  else =>",
            "                    trap('not array')",
            "            let $3 = Any.drop($0)",
            "            $2",
            "        let $4 = Containers.length($1)",
            "        let $5 = Any.drop($1)",
            "        $4",
            "    )",
            "",
            "fn nested(v: any) -> any =",
            "    let #0 =",
            "        let $0 = Containers.seal(Containers.push(Containers.begin_array(1), Any.dup(v)))",
            "        let $2 =",
            "            match $0",
            "              array as array =>",
            "                Any.dup(array)",
            "              else =>",
            "                trap('not array')",
            "        let $3 = Any.drop($0)",
            "        $2",
            "    let $1 = Containers.seal(Containers.push(Containers.push(Containers.push(Containers.push(Containers.begin_array(4), #0), Any.dup(\"x\")), Any.undefined), Any.null))",
            "    let $4 =",
            "        match $1",
            "          array as array =>",
            "            Any.dup(array)",
            "          else =>",
            "            trap('not array')",
            "    let $5 = Any.drop($1)",
            "    $4",
            "",
            "fn none() -> any.only(array, object) =",
            "    let $0 = Containers.seal(Containers.begin_array(0))",
            "    let $1 =",
            "        match $0",
            "          array as array =>",
            "            Any.dup(array)",
            "          else =>",
            "            trap('not array')",
            "    let $2 = Any.drop($0)",
            "    $1",
            "",
            "fn pair(a: any, b: any) -> any.only(array, object) =",
            "    let $0 = Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), Any.dup(a)), Any.dup(b)))",
            "    let $1 =",
            "        match $0",
            "          array as array =>",
            "            Any.dup(array)",
            "          else =>",
            "            trap('not array')",
            "    let $2 = Any.drop($0)",
            "    $1",
            "",
            "fn second(a: any, b: any) -> any =",
            "    let #0 =",
            "        let $0 = Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), Any.dup(a)), Any.dup(b)))",
            "        let $1 =",
            "            match $0",
            "              array as array =>",
            "                Any.dup(array)",
            "              else =>",
            "                trap('not array')",
            "        let $2 = Any.drop($0)",
            "        $1",
            "    let $3 =",
            "        let #0.index = trunc_sat(u(31), 1.0)",
            "        if eq(float(#0.index), 1.0) then Containers.item(#0, #0.index) else trap('inexact')",
            "    let $4 = Any.drop(#0)",
            "    $3",
            "",
            "export both, counted, nested, none, pair, second",
            "",
        ].join('\n'))
    },
    // The owned stage of the reads: an item that a read answers is owned, and so is `undefined` where it reads none.
    reads: () => {
        const m = fromReads()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            "const #c0: any.only(array) =",
            "    let $0 = Containers.seal(Containers.push(Containers.push(Containers.push(Containers.begin_array(3), Any.dup(\"a\")), Any.dup(\"b\")), Any.dup(\"c\")))",
            "    let $1 =",
            "        match $0",
            "          array as array =>",
            "            Any.dup(array)",
            "          else =>",
            "            trap('not array')",
            "    let $2 = Any.drop($0)",
            "    $1",
            "",
            "fn inner(a: any, k: f64) -> any =",
            "    let #0 =",
            "        let #0 =",
            "            let $0 = Containers.seal(Containers.push(Containers.begin_array(1), Any.dup(a)))",
            "            let $2 =",
            "                match $0",
            "                  array as array =>",
            "                    Any.dup(array)",
            "                  else =>",
            "                    trap('not array')",
            "            let $3 = Any.drop($0)",
            "            $2",
            "        let $1 = Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), #0), Any.dup(\"x\")))",
            "        let $4 =",
            "            match $1",
            "              array as array =>",
            "                Any.dup(array)",
            "              else =>",
            "                trap('not array')",
            "        let $5 = Any.drop($1)",
            "        $4",
            "    let $6 =",
            "        let #0.index = trunc_sat(u(31), k)",
            "        if eq(float(#0.index), k)",
            "        then",
            "            if lt(#0.index, Containers.length(#0)) then Containers.item(#0, #0.index) else Any.undefined",
            "        else",
            "            Any.undefined",
            "    let $7 = Any.drop(#0)",
            "    $6",
            "",
            "fn letter(k: f64) -> any =",
            "    let array.index = trunc_sat(u(31), k)",
            "    if eq(float(array.index), k)",
            "    then",
            "        if lt(array.index, Containers.length(self.#c0)) then Containers.item(self.#c0, array.index) else Any.undefined",
            "    else",
            "        Any.undefined",
            "",
            "fn only(a: any) -> any =",
            "    let #0 =",
            "        let $0 = Containers.seal(Containers.push(Containers.begin_array(1), Any.dup(a)))",
            "        let $1 =",
            "            match $0",
            "              array as array =>",
            "                Any.dup(array)",
            "              else =>",
            "                trap('not array')",
            "        let $2 = Any.drop($0)",
            "        $1",
            "    let $3 =",
            "        let #0.index = trunc_sat(u(31), 0.0)",
            "        if eq(float(#0.index), 0.0)",
            "        then",
            "            if lt(#0.index, Containers.length(#0)) then Containers.item(#0, #0.index) else Any.undefined",
            "        else",
            "            Any.undefined",
            "    let $4 = Any.drop(#0)",
            "    $3",
            "",
            "fn pick(a: any, b: any, k: f64) -> any =",
            "    let #0 =",
            "        let $0 = Containers.seal(Containers.push(Containers.push(Containers.begin_array(2), Any.dup(a)), Any.dup(b)))",
            "        let $1 =",
            "            match $0",
            "              array as array =>",
            "                Any.dup(array)",
            "              else =>",
            "                trap('not array')",
            "        let $2 = Any.drop($0)",
            "        $1",
            "    let $3 =",
            "        let #0.index = trunc_sat(u(31), k)",
            "        if eq(float(#0.index), k)",
            "        then",
            "            if lt(#0.index, Containers.length(#0)) then Containers.item(#0, #0.index) else Any.undefined",
            "        else",
            "            Any.undefined",
            "    let $4 = Any.drop(#0)",
            "    $3",
            "",
            "export inner, letter, only, pick",
            "",
        ].join('\n'))
    },
    // Each array is the twin's, item by item, and each call seals every builder that it begins and leaves the cells as it found them.
    arraysRun: () => run(fromArrays(), arrayTwins, {}),
    readsRun: () => run(fromReads(), readTwins, {}),
    // A throw of a value is `Functions.throw` of it, and a read of L1's error table the string literal of its text.
    throws: () => {
        const m = fromThrows()
        assertStructurallySame(m.imports, [...l0, ['Native', native]])
        assertEq(print({ ...m, imports: [] }), [
            'fn bigints(a: any, b: any) -> bool =',
            '    let #0 = float(Any.kind(a))',
            '    if if eq(#0, float(Any.kind(b))) then false else true then Functions.throw(Any.dup("TypeError: Cannot mix BigInt and other types, use explicit conversions")) else eq(#0, 5.0)',
            '',
            'fn rethrow(v: any) -> any =',
            '    Functions.throw(Any.dup(v))',
            '',
            'fn sign(x: f64) -> f64 =',
            '    if if eq(x, x) then false else true then Functions.throw(Any.dup("TypeError: unexpected type")) else if eq(x, 0.0) then Functions.throw(Any.dup("RangeError: Division by zero")) else if lt(x, 0.0) then -1.0 else 1.0',
            '',
            'fn textLength(v: any) -> f64 =',
            '    if if eq(float(Any.kind(v)), 4.0) then false else true',
            '    then',
            '        Functions.throw(Any.dup("not a string"))',
            '    else',
            '        float(',
            '            match v',
            '              string as v.string =>',
            '                String.length(v.string)',
            '              bigint as v.bigint =>',
            '                BigInt.length(v.bigint)',
            '              array | object as v.containers =>',
            '                Containers.length(v.containers)',
            '              function as v.functions =>',
            '                Functions.length(v.functions)',
            '              undefined | null | boolean | number =>',
            "                trap('no length')",
            '        )',
            '',
            'export bigints, rethrow, sign, textLength',
            '',
        ].join('\n'))
    },
    throwsRun: () => run(fromThrows(), throwTwins, {}),
    // L1's functionText, lowered from L1's text over its error table, throws what L1's own throws.
    l1Throws: () => assertEq(print({ ...fromL1Throws(), imports: [] }), [
        'fn functionText(t: any) -> any =',
        '    if if eq(float(Any.kind(t)), 4.0) then false else true then Functions.throw(Any.dup("TypeError: Cannot convert a function to its text")) else Any.dup(t)',
        '',
        'export functionText',
        '',
    ].join('\n')),
    l1ThrowsRun: () => run(fromL1Throws(), { functionText: ([t]) => ({ any: functionText(held(t)) }) }, {}),
    // buildArray is one loop of Containers' builder, and the callbacks are inlined in it.
    builds: () => assertEq(print({ ...fromBuilds(), imports: [] }).split('\n\n').find(f => f.startsWith('fn repeated(')), [
        'fn repeated(v: any, n: f64) -> any.only(array) =',
        '    let B0.n = trunc_sat(u(31), n)',
        '    if eq(float(B0.n), n)',
        '    then',
        '        loop B0 (B0.b: builder = Containers.begin_array(B0.n), B0.s: f64 = 0.0, B0.i: f64 = 0.0)',
        '            if lt(B0.i, float(B0.n))',
        '            then',
        '                let B0.item = Any.dup(v)',
        '                let B0.pushed = Containers.push(B0.b, B0.item)',
        '                let B0.i.next = add(B0.i, 1.0)',
        '                let B0.s.next = if lt(B0.i.next, float(B0.n)) then add(B0.s, 1.0) else B0.s',
                '                br B0 { B0.b: B0.pushed, B0.s: B0.s.next, B0.i: B0.i.next }',
        '            else',
        '                let $0 = Containers.seal(B0.b)',
        '                let $1 =',
        '                    match $0',
        '                      array as B0.array =>',
        '                        Any.dup(B0.array)',
        '                      else =>',
        "                        trap('not array')",
        '                let $2 = Any.drop($0)',
        '                $1',
        '    else',
        "        trap('inexact')",
    ].join('\n')),
    // `ordered` throws `at`'s value, not `step`'s, and `stepped` throws `step`'s after its first item: each leaves its builder behind, which the host recovers.
    buildsRun: () => run(fromBuilds(), buildTwins, {
        repeated: product([[{ any: 'v' }, { any: [] }], [0, -0, 1, 3, 0.5, -1, NaN, Infinity, 2147483648]]),
        step: [0, 1, -1, NaN].map(x => [x]),
        at: product([[{ any: 'v' }], [0, 1]]),
    }, ['ordered', 'stepped']),
    // L1's toIterable, lowered from L1's text: an array as it is, and a string's code points, each built in one pass.
    l1IterableRun: () => run(fromL1Iterable(), { toIterable: ([v]) => ({ any: toIterable(held(v)) }) }, { toIterable: iterables }),
    l1Run: () => run(assertOk(lifetime(fromL1())), {
        toBoolean: ([v]) => toBoolean(held(v)),
        stringEquals: ([a, b]) => stringEquals(held(a), held(b)),
        stringLess: ([a, b]) => stringLess(held(a), held(b)),
        strictEquals: ([a, b]) => strictEquals(held(a), held(b)),
        stringIndex: ([s]) => stringIndex(held(s)),
        typeOf: ([v]) => ({ any: typeOf(held(v)) }),
    }, {
        stringEquals: pairs,
        stringLess: pairs,
        strictEquals: product([anyValues, anyValues]),
        stringIndex: [...spellings, ...[[], ['a'], {}, 1, 0n, undefined].map(any => ({ any }))].map(s => [s]),
    }),
    // Object literals: a record of floats, and Containers objects of values of any.
    // Records of floats stay products; object literals of values of `any` are Containers objects, cast to `object`.
    objects: () => assertEq(print({ ...fromObjects(), imports: [] }), [
        'fn area(a: f64, b: f64) -> f64 =',
        '    let #0 = { x: a, y: b }',
        '    mul(#0.x, #0.y)',
        '',
        'fn empty() -> any.only(array, object) =',
        '    let $0 = Containers.seal(Containers.begin_object(0))',
        '    let $1 =',
        '        match $0',
        '          object as object =>',
        '            Any.dup(object)',
        '          else =>',
        "            trap('not object')",
        '    let $2 = Any.drop($0)',
        '    $1',
        '',
        'fn nested(v: any) -> any =',
        '    let #0 =',
        '        let $0 = Containers.seal(Containers.push_property(Containers.begin_object(1), Any.dup("v"), Any.dup(v)))',
        '        let $2 =',
        '            match $0',
        '              object as object =>',
        '                Any.dup(object)',
        '              else =>',
        "                trap('not object')",
        '        let $3 = Any.drop($0)',
        '        $2',
        '    let $1 = Containers.seal(Containers.push_property(Containers.begin_object(1), Any.dup("inner"), #0))',
        '    let $4 =',
        '        match $1',
        '          object as object =>',
        '            Any.dup(object)',
        '          else =>',
        "            trap('not object')",
        '    let $5 = Any.drop($1)',
        '    $4',
        '',
        'fn pair(a: any, b: any) -> any.only(array, object) =',
        '    let $0 = Containers.seal(Containers.push_property(Containers.push_property(Containers.begin_object(2), Any.dup("a"), Any.dup(a)), Any.dup("b"), Any.dup(b)))',
        '    let $1 =',
        '        match $0',
        '          object as object =>',
        '            Any.dup(object)',
        '          else =>',
        "            trap('not object')",
        '    let $2 = Any.drop($0)',
        '    $1',
        '',
        'export area, empty, nested, pair',
        '',
    ].join('\n')),
    objectsRun: () => run(fromObjects(), {
        area: ([x, y]) => /** @type {number} */ (x) * /** @type {number} */ (y),
        empty: () => ({ any: {} }),
        pair: ([a, b]) => ({ any: { a: held(a), b: held(b) } }),
        nested: ([v]) => ({ any: { inner: { v: held(v) } } }),
    }, {
        area: product([[0, 1, -2, 0.5], [0, 1, 3, -0.5]]),
        nested: anyValues.map(v => [v]),
    }),
    // L1's toIterable and objectSpread, lowered from L1's text: each builds what L1's own builds.
    l1Builders: () => {
        const m = fromL1Builders()
        assert(print({ ...m, imports: [] }).includes('Containers.begin_array'))
        assert(print({ ...m, imports: [] }).includes('Containers.begin_object'))
    },
    l1BuildersRun: () => run(fromL1Builders(), {
        toIterable: ([v]) => ({ any: toIterable(held(v)) }),
        objectSpread: ([v]) => ({ any: objectSpread(held(v)) }),
    }, {
        toIterable: [
            ...[[], [1], [1, 2], 'a', 'ab', '\uD800\uDC00', '\uD800'].map(any => [{ any }]),
        ],
        objectSpread: [
            ...[{}, { a: 1 }, [], [1, 2], 'ab', 1, null, undefined].map(any => [{ any }]),
        ],
    }, ['toIterable']),
    // L1's coercions and call, lowered from L1's text: each answers what L1's own answers.
    l1Coerce: () => {
        const text = print({ ...fromL1Coerce(), imports: [] })
        assert(text.includes('Functions.call'))
        assert(text.includes('Containers.find'))
        assert(text.includes('Functions.text'))
        assert(text.includes('Containers.join'))
    },
    l1CoerceRun: () => {
        /** @type {StringMap<_Twin>} */
        const twins = {
            functionText: ([t]) => ({ any: functionText(held(t)) }),
            toPrimitive: ([v, preferString]) => ({ any: toPrimitive(held(v), preferString === true) }),
            toNumber: ([v]) => toNumber(held(v)),
            toNumeric: ([v]) => ({ any: toNumeric(held(v)) }),
            // `toString` as a key needs an explicit `_Twin`: Object's method
            // type and a destructuring twin do not assign under StringMap.
            toString: /** @type {_Twin} */ (xs => ({ any: l1ToString(held(xs[0])) })),
            call: ([f, args]) => ({ any: l1Call(held(f), held(args)) }),
        }
        return run(fromL1Coerce(), twins, {
            toPrimitive: [
                ...[1, 'a', true, null, undefined, 1n, [], {}, (/** @type {unknown} */ x) => x].map(any => [{ any }, false]),
            ],
            toNumber: [
                ...[1, '1', true, false, null, undefined, [], (/** @type {unknown} */ x) => x].map(any => [{ any }]),
            ],
            toNumeric: [
                ...[1, 1n, '1', true, null, (/** @type {unknown} */ x) => x].map(any => [{ any }]),
            ],
            toString: [
                ...[1, 'a', true, null, undefined, 1n, [], {}, (/** @type {unknown} */ x) => x].map(any => [{ any }]),
            ],
            call: [
                [{ any: (/** @type {unknown} */ a, /** @type {unknown} */ b) => /** @type {number} */ (a) + /** @type {number} */ (b) }, { any: [2, 3] }],
                [{ any: () => 'ok' }, { any: [] }],
            ],
        }, ['toPrimitive', 'toNumber', 'toNumeric', 'toString', 'call'])
    },
    // L1's `get`, lowered from L1's text: each answers what L1's own answers.
    l1Get: () => {
        const text = print({ ...fromL1Get(), imports: [] })
        assert(text.includes('Containers.find'))
        assert(text.includes('Native.numberToString'))
        assert(text.includes('Functions.throw'))
        assert(text.includes('stringEquals'))
        assert(text.includes('stringIndex'))
    },
    l1GetRun: () => {
        /** @type {StringMap<_Twin>} */
        const twins = {
            stringEquals: ([a, b]) => stringEquals(held(a), held(b)),
            stringIndex: ([s]) => stringIndex(held(s)),
            get: ([a, k]) => ({ any: l1GetFn(held(a), held(k)) }),
        }
        const f = /** @type {() => unknown} */ (() => {})
        return run(fromL1Get(), twins, {
            stringEquals: [
                [{ any: 'a' }, { any: 'a' }],
                [{ any: 'a' }, { any: 'b' }],
            ],
            stringIndex: [
                [{ any: '0' }],
                [{ any: '01' }],
                [{ any: 'a' }],
            ],
            get: [
                [{ any: { a: 1 } }, { any: 'a' }],
                [{ any: { a: 1 } }, { any: 0 }],
                [{ any: [10, 20] }, { any: 1 }],
                [{ any: [10, 20] }, { any: '1' }],
                [{ any: [10, 20] }, { any: 'length' }],
                [{ any: 'ab' }, { any: 1 }],
                [{ any: 'ab' }, { any: 'length' }],
                [{ any: f }, { any: 'length' }],
                [{ any: f }, { any: 'name' }],
                [{ any: 1 }, { any: 'x' }],
                [{ any: true }, { any: 0 }],
                [{ any: undefined }, { any: 'a' }],
                [{ any: null }, { any: 'a' }],
            ],
        })
    },
    // L1's arithmetic and relations, lowered from L1's text: each answers what L1's own answers.
    l1Arith: () => {
        const text = print({ ...fromL1Arith(), imports: [] })
        assert(text.includes('Native.bigintAdd'))
        assert(text.includes('Native.bigintLess'))
        assert(text.includes('Native.bigintDivide'))
        assert(text.includes('Functions.throw'))
        assert(text.includes('stringLess'))
    },
    l1ArithRun: () => {
        /** @type {StringMap<_Twin>} */
        const twins = {
            functionText: ([t]) => ({ any: functionText(held(t)) }),
            toPrimitive: ([v, preferString]) => ({ any: toPrimitive(held(v), preferString === true) }),
            toNumber: ([v]) => toNumber(held(v)),
            toNumeric: ([v]) => ({ any: toNumeric(held(v)) }),
            number: ([v]) => number(held(v)),
            toString: /** @type {_Twin} */ (xs => ({ any: l1ToString(held(xs[0])) })),
            stringLess: ([a, b]) => stringLess(held(a), held(b)),
            add: ([a, b]) => ({ any: add(held(a), held(b)) }),
            subtract: ([a, b]) => ({ any: subtract(held(a), held(b)) }),
            multiply: ([a, b]) => ({ any: multiply(held(a), held(b)) }),
            divide: ([a, b]) => ({ any: divide(held(a), held(b)) }),
            remainder: ([a, b]) => ({ any: remainder(held(a), held(b)) }),
            shiftRight: ([a, b]) => ({ any: shiftRight(held(a), held(b)) }),
            bitwiseAnd: ([a, b]) => ({ any: bitwiseAnd(held(a), held(b)) }),
            negate: ([a]) => ({ any: negate(held(a)) }),
            lessThan: ([a, b]) => lessThan(held(a), held(b)),
            greaterThan: ([a, b]) => greaterThan(held(a), held(b)),
            lessThanOrEqual: ([a, b]) => lessThanOrEqual(held(a), held(b)),
            greaterThanOrEqual: ([a, b]) => greaterThanOrEqual(held(a), held(b)),
        }
        // `divide` and `remainder` may abandon what they hold when
        // `Native.bigintDivide` or `Native.bigintRemainder` throws for a zero
        // divisor: that throw is a callee's, not `Functions.throw`.
        return run(fromL1Arith(), twins, {
            functionText: [[{ any: 'x' }]],
            toPrimitive: [[{ any: 1 }, false], [{ any: 'a' }, true]],
            toNumber: [[{ any: 1 }], [{ any: '2' }], [{ any: true }]],
            toNumeric: [[{ any: 1 }], [{ any: 1n }], [{ any: '1' }]],
            number: [[{ any: 1 }], [{ any: 2n ** 64n }], [{ any: ' 3 ' }], [{ any: [4] }]],
            toString: [[{ any: 1 }], [{ any: 'a' }], [{ any: 1n }]],
            stringLess: [[{ any: 'a' }, { any: 'b' }], [{ any: 'b' }, { any: 'a' }]],
            add: [
                [{ any: 2 }, { any: 3 }],
                [{ any: 1n }, { any: 2n }],
                [{ any: 'a' }, { any: 1 }],
                [{ any: 1 }, { any: 'b' }],
                [{ any: 1n }, { any: 1 }],
            ],
            subtract: [
                [{ any: 5 }, { any: 2 }],
                [{ any: 5n }, { any: 2n }],
                [{ any: 1n }, { any: 1 }],
            ],
            multiply: [
                [{ any: 3 }, { any: 4 }],
                [{ any: 3n }, { any: 4n }],
            ],
            divide: [
                [{ any: 8 }, { any: 2 }],
                [{ any: 8n }, { any: 2n }],
                [{ any: 1 }, { any: 0 }],
                [{ any: 1n }, { any: 0n }],
            ],
            remainder: [
                [{ any: -7 }, { any: 2 }],
                [{ any: -7n }, { any: 2n }],
                [{ any: '9' }, { any: 4 }],
                [{ any: 1n }, { any: 0n }],
                [{ any: 1n }, { any: 1 }],
            ],
            shiftRight: [
                [{ any: -9 }, { any: 1 }],
                [{ any: -9n }, { any: 1n }],
                [{ any: 2 ** 32 + 8 }, { any: 33 }],
                [{ any: 1n }, { any: 1 }],
            ],
            bitwiseAnd: [
                [{ any: 12 }, { any: 10 }],
                [{ any: -4n }, { any: -6n }],
                [{ any: true }, { any: '3' }],
            ],
            negate: [
                [{ any: 3 }],
                [{ any: 3n }],
                [{ any: -0 }],
            ],
            lessThan: [
                [{ any: 1 }, { any: 2 }],
                [{ any: 2 }, { any: 1 }],
                [{ any: 'a' }, { any: 'b' }],
                [{ any: 1n }, { any: 2n }],
                [{ any: 1n }, { any: 2 }],
                [{ any: NaN }, { any: 1 }],
            ],
            greaterThan: [
                [{ any: 2 }, { any: 1 }],
                [{ any: 1n }, { any: 2n }],
            ],
            lessThanOrEqual: [
                [{ any: 1 }, { any: 1 }],
                [{ any: 1 }, { any: 2 }],
                [{ any: NaN }, { any: 1 }],
            ],
            greaterThanOrEqual: [
                [{ any: 2 }, { any: 1 }],
                [{ any: 1n }, { any: 1n }],
            ],
        }, ['divide', 'remainder'])
    },
    // Every export of L1, lowered from its text as one module: each answers
    // what L1's own answers on the values of the parity table.
    l1Whole: () => {
        const m = fromL1Whole()
        assertEq([...m.exports].toSorted().join(' '), Object.keys(l1Whole).toSorted().join(' '))
        const text = print({ ...m, imports: [] })
        assert(text.includes('fn toPropertyKey('))
    },
    l1WholeRun: () => {
        /** @type {(f: (...xs: readonly unknown[]) => unknown) => _Twin} */
        const boxed = f => xs => ({ any: f(...xs.map(held)) })
        /** @type {(f: (...xs: readonly unknown[]) => _Value) => _Twin} */
        const plain = f => xs => f(...xs.map(held))
        /** @type {StringMap<_Twin>} */
        const twins = {
            typeOf: boxed(typeOf),
            toBoolean: plain(toBoolean),
            stringEquals: plain(stringEquals),
            stringLess: plain(stringLess),
            strictEquals: plain(strictEquals),
            stringIndex: plain(stringIndex),
            functionText: boxed(functionText),
            toPrimitive: ([v, preferString]) => ({ any: toPrimitive(held(v), preferString === true) }),
            toNumber: plain(toNumber),
            toNumeric: boxed(toNumeric),
            number: plain(number),
            toString: boxed(l1ToString),
            toPropertyKey: boxed(toPropertyKey),
            add: boxed(add),
            subtract: boxed(subtract),
            multiply: boxed(multiply),
            divide: boxed(divide),
            remainder: boxed(remainder),
            shiftRight: boxed(shiftRight),
            bitwiseAnd: boxed(bitwiseAnd),
            negate: boxed(negate),
            lessThan: plain(lessThan),
            greaterThan: plain(greaterThan),
            lessThanOrEqual: plain(lessThanOrEqual),
            greaterThanOrEqual: plain(greaterThanOrEqual),
            get: boxed(l1GetFn),
            call: boxed(l1Call),
            toIterable: boxed(toIterable),
            objectSpread: boxed(objectSpread),
            toIntegerOrInfinity: ([x]) => toIntegerOrInfinity(/** @type {number} */ (x)),
            requireObjectCoercible: boxed(requireObjectCoercible),
            charCodeAt: boxed(charCodeAt),
            at: boxed(l1At),
            every: boxed(every),
            filter: boxed(filter),
        }
        // The values and keys of the parity table, which
        // `../../wasm/runtime/l1/parity/proof.mjs` runs against the
        // interpreter. The twin is L1's own on the same host, so a function's
        // text agrees and joins every table.
        const values = withFunction.map(value)
        const keys = keySources.map(value)
        const f = values[values.length - 1]
        const strings = values.filter(v => typeof v === 'string')
        /** @type {(vs: readonly unknown[]) => readonly (readonly _Value[])[]} */
        const one = vs => vs.map(any => [{ any }])
        /** @type {(as: readonly unknown[], bs: readonly unknown[]) => readonly (readonly _Value[])[]} */
        const two = (as, bs) => as.flatMap(a => bs.map(b => [{ any: a }, { any: b }]))
        const pairs = two(values, values)
        // The receivers of `every` and `filter`: arrays, and values of each
        // other kind; and callbacks, the last of them no function.
        /** @type {readonly unknown[]} */
        const lists = [[], [1, 'a', 0, null], [[], ''], ...values]
        /** @type {readonly unknown[]} */
        const callbacks = [f, (/** @type {unknown} */ x) => x, () => 0, (/** @type {unknown} */ _, /** @type {number} */ i) => i % 2, 1]
        // `divide` may abandon what it holds when `Native.bigintDivide` throws
        // for a zero divisor, as in `l1ArithRun`.
        return run(fromL1Whole(), twins, {
            typeOf: one(values),
            toBoolean: one(values),
            stringEquals: two(strings, strings),
            stringLess: two(strings, strings),
            strictEquals: pairs,
            stringIndex: one(strings),
            functionText: one(strings),
            toPrimitive: [false, true].flatMap(p => values.map(any => [{ any }, p])),
            toNumber: one(values),
            toNumeric: one(values),
            number: one(values),
            toString: one(values),
            toPropertyKey: one(values),
            add: pairs,
            subtract: pairs,
            multiply: pairs,
            divide: pairs,
            remainder: pairs,
            shiftRight: pairs,
            bitwiseAnd: pairs,
            negate: one(values),
            lessThan: pairs,
            greaterThan: pairs,
            lessThanOrEqual: pairs,
            greaterThanOrEqual: pairs,
            get: two(values, keys),
            call: [
                [{ any: f }, { any: [1] }],
                [{ any: (/** @type {unknown} */ a, /** @type {unknown} */ b) => /** @type {number} */ (a) + /** @type {number} */ (b) }, { any: [2, 3] }],
                [{ any: 1 }, { any: [] }],
            ],
            toIterable: one(values),
            objectSpread: one(values),
            toIntegerOrInfinity: [NaN, 1.9, -1.9, Infinity, -Infinity, -0, 0].map(x => [x]),
            requireObjectCoercible: one(values),
            charCodeAt: two(values, keys),
            at: two(values, keys),
            every: two(lists, callbacks),
            filter: two(lists, callbacks),
        }, ['divide', 'remainder'])
    },
    // Slice 11a: every export of the programs, of `any` alone, and the
    // bodies of L1 that they reach, by their linked names, and no others.
    programs: () => {
        const m = fromPrograms()
        assertEq([...m.exports].toSorted().join(' '), Object.keys(programs).toSorted().join(' '))
        assertEq(m.imports.map(([k]) => k).join(' '), 'Ref String BigInt Containers Functions Native')
        assert(m.defines !== undefined && m.defines.name === 'Any')
        const names = m.functions.map(([k]) => k)
        assert(names.includes('l1.add') && names.includes('l1.toPrimitive'))
        // Any's isRef and its scalar functions are hinted always, so the inline pass writes them into their callers and leaves them out.
        assert(names.includes('any.kind') && names.includes('any.dup'))
        for (const k of ['isRef', 'to_f64', 'from_f64', 'to_bool', 'from_bool', 'same']) { assert(!names.includes(`any.${k}`), k) }
        assert(names.includes('kind'))
        assert(!names.includes('l1.toIterable') && !names.includes('l1.objectSpread'))
        const text = print({ ...m, imports: [] })
        assert(text.includes('fn sum3(p0: any, p1: any, p2: any) -> any ='))
        assert(text.includes('any.kind(') && !text.includes('Any.kind('))
    },
    // Each program answers what JavaScript answers on the values of the
    // parity table, an object of a nested object, one of a function and a
    // function of two arguments, and throws L1's value of the error that
    // JavaScript throws. A throw of L1 leaves what the caller made for it
    // behind, a boxed key or number, which the host recovers.
    programsRun: () => runPrograms(fromPrograms(), programs, ['allBelow', 'apply', 'below', 'bits', 'called', 'countDown', 'first', 'method', 'mixed', 'pair', 'sum3', 'twice']),
    // The records pass: the objects that a program only reads back by keys
    // that they have are split, so no function that reads one back builds
    // it, and every other object stays one.
    records: () => {
        const m = fromRecords()
        /** @type {(name: string) => string} */
        const text = name => print({ ...m, imports: [], functions: m.functions.filter(([k]) => k === name) })
        for (const name of ['pair', 'counted', 'both', 'nested', 'chosen']) { assert(!text(name).includes('begin_object'), name) }
        for (const name of ['whole', 'missing', 'twice', 'given', 'reordered', 'kept']) { assert(text(name).includes('begin_object'), name) }
    },
    // Each answers what JavaScript answers, split or not.
    recordsRun: () => runPrograms(fromRecords(), records, ['both', 'counted', 'given', 'kept', 'reordered']),
    // Slice 11b: every export of the closures, and the lifted code of each
    // function that they make as a value, `(#self, #args) -> any`, which reads
    // its frame through `#self`.
    closures: () => {
        const m = fromClosures()
        assertEq([...m.exports].toSorted().join(' '), Object.keys(closures).toSorted().join(' '))
        const text = print({ ...m, imports: [] })
        assert(text.includes('fn #f1(#self: any.only(function), #args: any.only(array)) -> any ='))
        assert(text.includes('Functions.make_function('))
        assert(text.includes('Functions.frame(#self, 0)'))
    },
    // Each export of the closures answers what JavaScript answers, as the
    // programs do, and each function that it answers agrees with
    // JavaScript's on probes of its own; `given` passes one to a function of
    // JavaScript, which calls it.
    closuresRun: () => runPrograms(fromClosures(), closures, ['applied', 'callTwice', 'given', 'sameLocal', 'viaCallback']),
    // Slice 11c: every export of the spreads, each against JavaScript.
    spreads: () => {
        const m = fromSpreads()
        assertEq([...m.exports].toSorted().join(' '), Object.keys(spreads).toSorted().join(' '))
    },
    spreadsRun: () => runPrograms(fromSpreads(), spreads, ['around', 'spreadCall', 'spreadMixed']),
}
