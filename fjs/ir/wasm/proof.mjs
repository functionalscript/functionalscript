/**
 * Host proofs of the emitter: what only a WebAssembly engine can settle.
 *
 * [`proof.f.js`](./proof.f.js) holds the WAT that the emitter writes.
 * Whether that is a module an engine accepts, and whether it computes what
 * the IR means, needs an engine, and FunctionalScript runs no WebAssembly.
 * So each module of [`testlib.f.js`](../testlib.f.js) is compiled here by
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
 * @import { Module, Term } from '../types.ts'
 * @import { _Twin, _Value } from './types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { ARRAY, FUNCTION, OBJECT, STRING, asNumber, kind, length } from '../../wasm/runtime/l0/module.f.js'
import { stringEquals, stringIndex, stringLess, toBoolean } from '../../wasm/runtime/l1/module.f.js'
import { any, array, container, func, l0 } from '../l0/module.f.js'
import { add, call, call_ref, code, codeOf, f64, fn, get, n, u } from '../module.f.js'
import { addressing, arrays, bits, constants, corners, literals, loops, records, samples, unknown } from '../testlib.f.js'
import { edges, held, product, run, spellings, trap } from './testlib.mjs'

// arrays

/** @type {(k: Term) => Term} */
const begin = k => call('Containers', 'begin_array', [k])

/** @type {(b: Term, v: Term) => Term} */
const push = (b, v) => call('Containers', 'push', [b, v])

/** @type {(b: Term) => Term} */
const seal = b => call('Containers', 'seal', [b])

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

/** The 64 bits of a float. @type {(x: number) => bigint} */
const bitsOf = x => {
    const view = new DataView(new ArrayBuffer(8))
    view.setFloat64(0, x)
    return view.getBigUint64(0)
}

/** The float of 64 bits. @type {(b: bigint) => number} */
const ofBits = b => {
    const view = new DataView(new ArrayBuffer(8))
    view.setBigUint64(0, b)
    return view.getFloat64(0)
}

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
    if (!Number.isInteger(x) || x < lo || hi < x) { trap('inexact') }
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

/**
 * Whether a memory grows by `k` pages, of those that the proof asks for, on
 * either host: 0, 1 and 2 pages fit, and 65,536 never does, since with the
 * page or more that a memory starts with they pass the most that a 32-bit
 * address reaches.
 *
 * @type {(k: _Value) => boolean}
 */
const grows = k => int(k) < 0x1_0000n

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
    fail: () => trap('no answer'),
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
    halve: ([x]) => num(x) * 0.5,
    eighth: () => 0.125,
    answer: () => 42n,
    far: () => -(1n << 40n),
    less: () => false,
    six: () => 6,
    aa: () => ({ any: 'aa' }),
    lengthOfAa: () => 2n,
    nothingKind: () => BigInt(kind(null)),
    truth: ([b]) => b,
    orUndefined: ([v]) => ({ any: typeof held(v) === 'number' ? held(v) : undefined }),
    empty: () => ({ any: '' }),
    hello: () => ({ any: 'hello' }),
    greeting: () => ({ any: 'hello, world' }),
    accent: () => 4n,
    smile: () => 0xde00n,
    suffixed: ([s]) => ({ any: `${held(s)}hello` }),
    emptyArray: () => ({ any: [] }),
    pairOf: ([a, b]) => ({ any: [held(a), held(b)] }),
    lettersAnd: ([v]) => ({ any: [['a', 'b'], held(v)] }),
    bound: ([v]) => ({ any: [held(v)] }),
    repeated: ([v, k]) => ({ any: Array.from({ length: Number(int(k)) }, () => held(v)) }),
    itemCount: () => 1n,
    mask: ([a, b]) => int(a) & int(b),
    either: ([a, b]) => int(a) | int(b),
    flip: ([a, b]) => int(a) ^ int(b),
    reference: ([k, p]) => int(k) << 48n | int(p) << 2n,
    shifted: ([a, k]) => int(a) << int(k) ^ int(a) >> int(k),
    drained: ([a, k]) => int(a) >> int(k),
    nibble: ([x]) => int(x) >> 48n & 15n,
    bitsOf: ([x]) => bitsOf(num(x)),
    ofBits: ([b]) => ofBits(int(b)),
    signOf: ([x]) => bitsOf(num(x)) >> 63n,
    negBits: ([x]) => Number.isNaN(num(x)) ? 0x7FF8_0000_0000_0000n : bitsOf(-num(x)),
    stored8: ([, v]) => v,
    stored16: ([, v]) => v,
    stored32: ([, v]) => v,
    stored64: ([, v]) => v,
    lowFirst: ([, v]) => int(v) & 0xffffn,
    grown: ([k]) => grows(k) ? 0n : -1n,
    after: ([k]) => grows(k) ? int(k) : 0n,
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
 * Offsets for a store and a load of `bytes` bytes, in the page that the
 * call grows for itself: the page's first byte, one that is not aligned, and
 * the last place where the bytes fit.
 *
 * @type {(bytes: bigint) => readonly _Value[]}
 */
const offsets = bytes => [0n, 3n, 0x1_0000n - bytes]

/** Pages to grow by: none, one, two, and more than a 32-bit address reaches, where `grow` answers `-1`. */
const growths = each([0n, 1n, 2n, 0x1_0000n])

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
    stored8: product([offsets(1n), edges(u(8))]),
    stored16: product([offsets(2n), edges(u(16))]),
    stored32: product([offsets(4n), edges(u(32))]),
    stored64: product([offsets(8n), edges(u(64))]),
    lowFirst: product([offsets(8n), edges(u(64))]),
    grown: growths,
    after: growths,
}

export const proof = {
    samples: () => run(samples, twins, inputs),
    corners: () => run(corners, twins, inputs),
    // The bit operators and a float's bits, on the edges of their types.
    bits: () => run(bits, twins, inputs),
    // L0's Memory on the memory that either host makes, NaNVM's too: a load reads what a store wrote, of each width,
    // the low byte first, at an offset that is not aligned too, in a page that each call grows for itself, and `grow`
    // adds pages up to the most that an address reaches.
    addressing: () => run(addressing, twins, inputs),
    unknown: () => run(unknown, twins, inputs),
    loops: () => run(loops, twins, inputs),
    records: () => run(records, twins, inputs),
    constants: () => run(constants, twins, inputs),
    literals: () => run(literals, twins, inputs),
    arrays: () => run(arrays, twins, inputs),
    // `Functions.call` applies an existing function value to a sealed args array.
    call: () => {
        /** @type {Module} */
        const m = {
            imports: l0,
            functions: [['apply', fn([['f', func], ['args', array]], any, (f, args) => call('Functions', 'call', [f, args]))]],
            exports: ['apply'],
        }
        const id = (/** @type {unknown} */ x) => x
        const pair = (/** @type {unknown} */ a, /** @type {unknown} */ b) => [a, b]
        run(m, {
            apply: ([f, args]) => ({ any: /** @type {(...xs: unknown[]) => unknown} */ (held(f))(.../** @type {unknown[]} */ (held(args))) }),
        }, {
            apply: [
                [{ any: id }, { any: [1] }],
                [{ any: pair }, { any: ['a', 'b'] }],
            ],
        })
    },
    // A `call_ref` of a `code` value computes what a direct call of that function computes.
    code: () => {
        const bin = code([['borrow', f64], ['borrow', f64]], f64)
        /** @type {Module} */
        const m = {
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['apply', fn([['c', bin], ['a', f64], ['b', f64]], f64, (c, a, b) => call_ref(c, [a, b]))],
                ['f', fn([['a', f64], ['b', f64]], f64, (a, b) => call('self', 'apply', [codeOf('sum'), a, b]))],
            ],
            exports: ['f'],
        }
        /** @type {_Twin} */
        const twin = ([a, b]) => num(a) + num(b)
        run(m, { f: twin }, { f: product([edges(['f64']), edges(['f64'])]) })
    },
    // An array that a call is given is answered as itself: a copy of it, though its items agree, is another value.
    given: () => {
        const item = call('Containers', 'item', [get('v'), n(0n)])
        /** @type {Module} */
        const copied = {
            imports: l0,
            functions: [['copied', fn([['v', array]], container, seal(push(begin(n(1n)), item)))]],
            exports: ['copied'],
        }
        const v = /** @type {const} */ (['x'])
        const rows = /** @type {const} */ ({ copied: [[{ any: v }]] })
        run(copied, { copied: () => ({ any: ['x'] }) }, rows)
        /** @type {unknown} */
        let refused = null
        try { run(copied, { copied: ([x]) => ({ any: held(x) }) }, rows) } catch (e) { refused = e }
        assert(refused !== null, 'a copy of the given array is refused')
    },
}
