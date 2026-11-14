/**
 * Host proofs of the emitter: what only a WebAssembly engine can settle.
 *
 * [`proof.f.mjs`](./proof.f.mjs) holds the WAT that the emitter writes.
 * Whether that is a module an engine accepts, and whether it computes what
 * the IR means, needs an engine, and FunctionalScript runs no WebAssembly.
 * So each module of [`testlib.f.mjs`](../testlib.f.mjs) is compiled here by
 * the host's engine, and every function it exports is called on the edges of
 * its parameters' types and compared with a JavaScript twin, which computes
 * the same in exact integers and IEEE doubles, as
 * [`testlib.mjs`](./testlib.mjs) does it. The twins of the functions over
 * values of unknown kind are L1's own `toBoolean`, `stringEquals`,
 * `stringLess` and `stringIndex`, and the functions of the
 * [L0 view](../../wasm/runtime/l0/module.f.js) that they read. Where a
 * function loops as often as its argument says, or reads a float as an
 * integer, its inputs are chosen: small counts, and the floats beside each
 * bound that it saturates to or traps past.
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Twin, _Value } from './types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { ARRAY, FUNCTION, OBJECT, STRING, asNumber, kind, length } from '../../wasm/runtime/l0/module.f.js'
import { stringEquals, stringIndex, stringLess, toBoolean } from '../../wasm/runtime/l1/module.f.js'
import { any } from '../l0/module.f.js'
import { corners, loops, records, samples, unknown } from '../testlib.f.mjs'
import { edges, held, product, run, spellings } from './testlib.mjs'

// values

/** @type {(v: _Value) => bigint} */
const int = v => (assert(typeof v === 'bigint', v), v)

/** @type {(v: _Value) => number} */
const num = v => (assert(typeof v === 'number', v), v)

/** @type {(v: _Value) => boolean} */
const bit = v => (assert(typeof v === 'boolean', v), v)

// twins

/** @type {(x: number, k: number) => number} */
const pow = (x, k) => k <= 0 ? 1 : x * pow(x, k - 1)

/** @type {(a: number, b: number) => number} */
const hypot = (a, b) => Math.sqrt(a * a + b * b)

/** `x!` as a loop of floats counts it down: `1` where `x` is not above `0`. @type {(x: number) => number} */
const factorial = x => {
    let k = x
    let acc = 1
    while (0 < k) {
        acc = acc * k
        k = k - 1
    }
    return acc
}

/** `0 + 1 + ... + (n - 1)` for the first `n` at least `x`, one unit at a time. @type {(x: number) => number} */
const triangle = x => {
    let i = 0
    let s = 0
    while (i < x) {
        let j = 0
        let t = s
        while (j < i) {
            j = j + 1
            t = t + 1
        }
        i = i + 1
        s = t
    }
    return s
}

/** The `x`-th Fibonacci number, counted up in floats: `0` where `x` is not above `0`. @type {(x: number) => number} */
const fib = x => {
    let a = 0
    let b = 1
    let k = 0
    while (k < x) {
        const c = a + b
        a = b
        b = c
        k = k + 1
    }
    return a
}

/** The Fibonacci number that `steps` reaches, counted down from `x`, as `factorial` counts. @type {(x: number) => number} */
const steps = x => {
    let k = x
    let lo = 0
    let hi = 1
    while (0 < k) {
        const c = lo + hi
        lo = hi
        hi = c
        k = k - 1
    }
    return lo
}

/** The integer that a float holds exactly, in `lo` to `hi`; a throw for any other float. @type {(lo: number, hi: number) => (x: number) => bigint} */
const exactly = (lo, hi) => x => {
    if (!Number.isInteger(x) || x < lo || hi < x) { throw 'inexact' }
    return BigInt(x)
}

/** An index of a string: the integer that a float holds exactly, in `0` to `2 ** 31 - 1`. */
const index = exactly(0, 0x7fff_ffff)

/**
 * A float cut to an integer of `lo` to `hi`, as `trunc_sat` cuts it: toward
 * zero, `NaN` as zero, and the bound past which it lies.
 *
 * @type {(lo: bigint, hi: bigint) => _Twin}
 */
const saturated = (lo, hi) => ([x]) => {
    const n = num(x)
    const k = n !== n ? 0n : n <= Number(lo) ? lo : Number(hi) <= n ? hi : BigInt(Math.trunc(n))
    return k < lo ? lo : hi < k ? hi : k
}

/** What each exported function computes, on the same arguments. @type {StringMap<_Twin>} */
const twins = {
    max: ([a, b]) => num(a) < num(b) ? b : a,
    sum: ([a, b]) => int(a) + int(b),
    sign: ([x]) => int(x) < 0n ? -1n : x === 0n ? 0n : 1n,
    clamp: ([x, lo, hi]) => int(x) < int(lo) ? lo : int(hi) < int(x) ? hi : x,
    area: ([w, h]) => int(w) * int(h),
    diff: ([a, b]) => int(a) - int(b),
    double: ([a]) => int(a) + int(a),
    delta: ([a, b]) => int(a) - int(b),
    product: ([a, b]) => int(a) * int(b),
    same: ([a, b]) => int(a) === int(b),
    lessU32: ([a, b]) => int(a) < int(b),
    lessMixed: ([a, b]) => int(a) < int(b),
    lessU64: ([a, b]) => int(a) < int(b),
    atMost: ([a, b]) => int(a) <= int(b),
    atMostU32: ([a, b]) => int(a) <= int(b),
    atMostI64: ([a, b]) => int(a) <= int(b),
    atMostU64: ([a, b]) => int(a) <= int(b),
    notEqual: ([a, b]) => int(a) !== int(b),
    toFloat: ([a]) => Number(int(a)),
    toFloatSigned: ([a]) => Number(int(a)),
    toFloatWide: ([a]) => Number(int(a)),
    average: ([a, b]) => Number(int(a) + int(b)) / 2,
    magnitude: ([x]) => Math.abs(-num(x)),
    hypot: ([a, b]) => hypot(num(a), num(b)),
    distance: ([x, y, p, q]) => hypot(num(p) - num(x), num(q) - num(y)),
    safeDiv: ([a, b]) => num(b) === 0 ? 0 : num(a) / num(b),
    pow: ([x, k]) => pow(num(x), num(k)),
    pick: ([a, b]) => (0 < num(a) ? num(a) : 0 < num(b) ? num(b) : 0) + 1,
    xor: ([a, b]) => bit(a) ? !bit(b) : b,
    topU32: () => 0xffff_ffffn,
    topU64: () => 0xffff_ffff_ffff_ffffn,
    bottomI64: () => -(1n << 63n),
    wide: ([x]) => bit(x) ? 1n : 1n << 40n,
    unitLocal: () => true,
    oneArm: () => 1,
    falseFirst: ([a]) => bit(a) ? 1 : 0,
    neverBlock: ([x]) => x,
    neverIf: ([a]) => bit(a) ? 1 : 2,
    guarded: ([, x]) => x,
    twice: ([a]) => a,
    toBoolean: ([v]) => toBoolean(held(v)),
    kindOf: ([v]) => BigInt(kind(held(v))),
    isNumber: ([v]) => typeof held(v) === 'number',
    size: ([v]) => [STRING, ARRAY, OBJECT, FUNCTION].includes(kind(held(v))) ? BigInt(length(held(v))) : 0n,
    tag: ([v]) => BigInt(kind(held(v))),
    number: ([v]) => asNumber(held(v)),
    fail: () => { throw 'no answer' },
    falsy: ([v]) => !toBoolean(held(v)),
    stringEquals: ([a, b]) => stringEquals(held(a), held(b)),
    stringLess: ([a, b]) => stringLess(held(a), held(b)),
    factorial: ([x]) => factorial(num(x)),
    triangle: ([x]) => triangle(num(x)),
    kindAfter: ([v]) => BigInt(kind(held(v))),
    index: ([x]) => index(num(x)),
    indexOfSum: ([x]) => index(num(x) + 1),
    three: () => 3n,
    toU31: saturated(0n, 0x7fff_ffffn),
    toI32: saturated(-(1n << 31n), 0x7fff_ffffn),
    toU32: saturated(0n, 0xffff_ffffn),
    toSmall: saturated(-5n, 300n),
    toU64: saturated(0n, (1n << 64n) - 1n),
    toI64: saturated(-(1n << 63n), (1n << 63n) - 1n),
    toWide: saturated(10n, 1n << 40n),
    toNegative: saturated(-(1n << 40n), -3n),
    stringIndex: ([s]) => stringIndex(held(s)),
    midpoint: ([a, b]) => (num(a) + num(b)) / 2,
    fib: ([x]) => fib(num(x)),
    choose: ([k, x, y]) => bit(k) ? int(x) : int(y),
    middle: ([k, x]) => bit(k) ? 2 : -num(x),
    widened: ([, y]) => int(y),
    nested: ([x]) => num(x) * num(x) - num(x),
    steps: ([x]) => steps(num(x)),
    describe: ([v]) => typeof held(v) === 'number' ? asNumber(held(v)) : 0,
    kindOfFirst: ([v]) => BigInt(kind(held(v))),
}

/** Values of `any` for the string comparisons: strings that share a prefix, the two ends of a unit, a pair of surrogates, and values of other kinds, which trap. */
const texts = ['', 'a', 'ab', 'ac', 'b', 'ba', '\uffff', '\u{1F600}', [], 0, undefined].map(v => ({ any: v }))


/** Small counts, which loops end on, beside the floats that end a loop at once. */
const counts = [0, -0, 1, 2, 2.5, 3, 5, 10, -1, -Infinity, NaN, 5e-324]

/** Floats beside each bound of an index or of `trunc_sat`'s ranges, and the edges of a float. */
const bounds = [
    ...edges(['f64']), 3, -1, 9.5, 10.5, 300.5, 301, -5.5, -6, 0x7fff_ffff, 2 ** 31, 0xffff_ffff, 2 ** 32,
    2 ** 40, 2 ** 40 + 1, -(2 ** 40) - 1, 2 ** 63, 2 ** 64, -(2 ** 63), -(2 ** 64),
]

/** One argument of each of the values. @type {(xs: readonly _Value[]) => readonly (readonly _Value[])[]} */
const each = xs => xs.map(x => [x])

/**
 * The arguments of the functions that the edges do not suit: `pow` recurses
 * `k` times, `guarded` never returns where its `a` is `true`, the loops run
 * as often as a float says, the string comparisons need strings that part
 * late, and an index and `trunc_sat` the floats beside their bounds.
 *
 * @type {StringMap<readonly (readonly _Value[])[]>}
 */
const inputs = {
    pow: product([edges(['f64']), [0, -0, 1, 2, 10, -1, 0.5, 3.5]]),
    guarded: product([[false], edges(['f64'])]),
    stringEquals: product([texts, texts]),
    stringLess: product([texts, texts]),
    factorial: each([...counts, 170, 171]),
    triangle: each(counts),
    kindAfter: product([edges(any), [0, 1, 3, -1, NaN]]),
    index: each(bounds),
    indexOfSum: each(bounds),
    toU31: each(bounds),
    toI32: each(bounds),
    toU32: each(bounds),
    toSmall: each(bounds),
    toU64: each(bounds),
    toI64: each(bounds),
    toWide: each(bounds),
    toNegative: each(bounds),
    stringIndex: each(spellings),
    fib: each([...counts, 20, 78.5]),
    steps: each(counts),
}

export const proof = {
    samples: () => run(samples, twins, inputs),
    corners: () => run(corners, twins, inputs),
    unknown: () => run(unknown, twins, inputs),
    loops: () => run(loops, twins, inputs),
    records: () => run(records, twins, inputs),
}
