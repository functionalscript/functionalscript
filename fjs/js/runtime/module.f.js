/**
 * The built-in functions, defined once: two tables, and the `runtime`
 * export, three functions an executor asks — two over the tables, and the
 * body of the `in` operator — the one place each resolution is written
 * ([DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
 *
 * `member` holds, by name, the member functions whose body is written,
 * `startsWith`, `codePointAt` and `map`: each a FunctionalScript function of the
 * receiver alone, answering `undefined` for a receiver the name is no
 * member of, or the function of the arguments as the call passed them,
 * `undefined` past the end — so the body dispatches on its receiver's type
 * itself, and an executor asks it in two steps, the first before any
 * argument exists, which is what the guard of `a.startsWith?.(x)` needs.
 * `statics` holds the static functions by id, the path
 * [`../static`](../static/module.f.js) admits joined by `.` as the EDAG
 * spells the node, `Object.is`, each a function of the arguments alone.
 * Each body is a VM's and no module's: a module calls the built-in,
 * `Object.is` or `Number.isInteger`, and every executor answers it from
 * here, so nothing else exports the body. A name without a body is absent
 * — a primitive no body can define in terms of the rest, or a name whose
 * body waits on a primitive the language has not admitted yet,
 * [`README.md`](./README.md) says which — and each VM answers it from its
 * own native table.
 *
 * `runtime.dot` is the dispatcher a call step asks: the callee of
 * `a[key](...)` on a non-nullish receiver — the receiver's own enumerable
 * property under the key, whatever it holds, which shadows a built-in as it
 * does in JavaScript, else what the `member` body of the name answers for
 * the receiver, else `undefined`, which the executor calls and throws for,
 * or skips under `?.()`. `runtime.static` answers a static function by
 * its id, the body or the built-in itself, or `undefined` for an id the
 * table lacks. Every executor asks `dot` before its natives, which answer
 * the names without a body
 * ([`../todo/runtime-members.md`](../todo/runtime-members.md)), and
 * `static` for every static read; neither reads a table itself.
 * `runtime.in` is the body of the operator `"k" in o`, which an executor
 * answers by calling it, or substitutes natively
 * ([`2346-in-operator.md`](../../../spec/todo/2346-in-operator.md)). The two
 * tables are exported for the type pins of [`./types.ts`](./types.ts),
 * which keep every key an admitted name, for the proof, and for the Rust
 * printer, which gives each static body the NativeFunction text of its id.
 * Which names a module may call stays
 * [`../prototype`](../prototype/module.f.js)'s. The README says how each
 * executor binds the runtime and how a name gets its body.
 *
 * @module
 */

import { isNegativeZero } from '../../types/number/is_negative_zero/module.f.js'
import { entry, hasEntry } from '../../types/object/entry/module.f.js'
import { charCodeAt, slice } from '../intrinsic/module.f.js'
import { map as arrayMap } from '../members/array/map/module.f.js'

/**
 * [`Number.isNaN`](https://tc39.es/ecma262/#sec-number.isnan): whether `n`
 * is `NaN`. `NaN` is the one value that is not strictly equal to itself, so
 * the comparison alone is the test: every other number, and every value of
 * another type, is `false`, without coercion, as the global `isNaN`, which
 * converts first, does not answer. The name ends in `_` so that it never
 * shadows that global.
 *
 * @type {(n: unknown) => boolean}
 */
const isNaN_ = n => n !== n

/**
 * [`Number.isFinite`](https://tc39.es/ecma262/#sec-number.isfinite):
 * whether `n` is a finite number. A number times `0` is `0` exactly when it
 * is finite: an infinity times `0` and `NaN` times `0` are both `NaN`, and
 * `-0` is `0` under `===`. A value of another type is `false` without
 * coercion, as the global `isFinite`, which converts first, does not
 * answer; the `_` is `isNaN_`'s.
 *
 * @type {(n: unknown) => boolean}
 */
const isFinite_ = n => typeof n === 'number' && n * 0 === 0

/**
 * [`Number.isInteger`](https://tc39.es/ecma262/#sec-number.isinteger):
 * whether `n` is a finite integral number, both zeros and integers beyond
 * the safe range included. A fraction, an infinity and `NaN` all leave a
 * remainder that is not `0`; a value of another type is `false` without
 * coercion.
 *
 * @type {(n: unknown) => boolean}
 */
const isInteger = n => typeof n === 'number' && n % 1 === 0

/**
 * [`Number.isSafeInteger`](https://tc39.es/ecma262/#sec-number.issafeinteger):
 * an integer within the exact integer range of a double, whose 53 bits of
 * precision make the inclusive bound `2^53 - 1` on either side.
 *
 * @type {(n: unknown) => boolean}
 */
const isSafeInteger = n => typeof n === 'number' && isInteger(n) && -0x1f_ffff_ffff_ffff <= n && n <= 0x1f_ffff_ffff_ffff

/**
 * [`Object.is`](https://tc39.es/ecma262/#sec-object.is): whether `a` and
 * `b` are the same value, SameValue, which is `===` except on the two
 * values `===` reads the other way. Two values equal under `===` are the
 * same unless one is `-0` and the other is not, and two values unequal
 * under `===` are the same only where both are `NaN`. An array, an object
 * and a function compare by identity, as `===` compares them.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
const is = (a, b) => a === b
    ? isNegativeZero(a) === isNegativeZero(b)
    : isNaN_(a) && isNaN_(b)

/**
 * [`Object.fromEntries`](https://tc39.es/ecma262/#sec-object.fromentries)
 * over the one iterable the language builds, an array: a fresh plain
 * object with, for each element in order, the element's `[0]` as a key and
 * its `[1]` as the value, each an own data property, so `__proto__` is a key
 * like any other. A later duplicate key replaces the value and keeps the
 * first key's position, as defining it again in an object literal does. The
 * element is read by index, not destructured: an array pattern iterates,
 * and JavaScript's answer for `{ 0: 'a', 1: 1 }` is `{ a: 1 }`. An element
 * that is not an object fails, as JavaScript's `TypeError` does, and so
 * does a value that is not an array: JavaScript iterates a string, which
 * the language does not admit as entries, and refuses the rest
 * ([`2360-built-in.md`](../../../spec/todo/2360-built-in.md#objectfromentries-proposal-and-approval)).
 * Each element copies the object built so far, so `n` entries cost O(n²);
 * an executor may answer the node natively only as a substitution of this
 * body ([DESIGN.md §13](../../../doc/DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
 *
 * @type {(entries: unknown) => { readonly [k in string]: unknown }}
 */
const fromEntries = entries => {
    if (!(entries instanceof Array)) { throw 'Object.fromEntries: not an array' }
    /** @type {{ readonly [k in string]: unknown }} */
    let result = {}
    let i = 0
    while (i < entries.length) {
        const e = entries[Number(i)]
        if (e === null || typeof e !== 'object' && typeof e !== 'function') { throw 'Object.fromEntries: an entry is not an object' }
        result = { ...result, [e[0]]: e[1] }
        i = i + 1
    }
    return result
}

/**
 * `ToNumber`, as the operators apply it: a bigint throws the `TypeError`
 * `ToNumber` throws, where `Number(x)` would convert it.
 *
 * @type {(value: unknown) => number}
 */
const toNumber = value => /** @type {number} */ (value) - 0

/*
 * The logarithm polynomial and compensated combination follow OpenLibm's
 * src/e_log2.c and src/k_log.h (FreeBSD/fdlibm). Exact power-of-two scaling
 * and an arithmetic high-part split replace their IEEE word operations.
 * https://github.com/JuliaMath/openlibm/blob/master/src/e_log2.c
 *
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 */

/** Exact powers of two and their exponents, largest first. */
const log2Scales = /** @type {const} */ ([
    [1.3407807929942597e154, 512],
    [1.157920892373162e77, 256],
    [3.402823669209385e38, 128],
    [1.8446744073709552e19, 64],
    [0x1_0000_0000, 32],
    [0x1_0000, 16],
    [0x100, 8],
    [16, 4],
    [4, 2],
    [2, 1],
])

/**
 * The numerical log2 kernel. Reduce exactly to x in [sqrt(.5), sqrt(2)),
 * approximate log(1+f) with f = x-1, and combine k + log(1+f)/ln(2) with
 * compensated arithmetic. No native logarithm, bit reinterpretation or
 * supporting Math function is needed. The proof checks a two-ULP accuracy
 * target against high-precision reference values and exact powers of two.
 *
 * @type {(n: number) => number}
 */
const numberLog2 = n => {
    if (!(n > 0)) { return n === 0 ? -Infinity : NaN }
    if (n === Infinity) { return n }
    /** @type {{ readonly x: number, readonly k: number }} */
    let state = { x: n, k: 0 }
    // Exact scaling, including the smallest subnormal, before normalization.
    if (state.x < 1) {
        state = { x: state.x * 4.49423283715579e307, k: -1022 } // 2^1022
        if (state.x < 1) {
            state = { x: state.x * 0x10_0000_0000_0000, k: state.k - 52 } // 2^52
        }
    }
    for (const [scale, exponent] of log2Scales) {
        if (state.x >= scale) {
            state = { x: state.x / scale, k: state.k + exponent }
        }
    }
    if (state.x >= 1.4142135623730951) {
        state = { x: state.x * 0.5, k: state.k + 1 }
    }
    const k = state.k
    const f = state.x - 1
    const s = f / (2 + f)
    const z = s * s
    const w = z * z
    const t1 = w * (3.999999999940941908e-1 + w * (2.222219843214978396e-1 + w * 1.531383769920937332e-1))
    const t2 = z * (6.666666666666735130e-1 + w * (2.857142874366239149e-1 + w * (1.818357216161805012e-1 + w * 1.479819860511658591e-1)))
    const r = t2 + t1
    const hfsq = 0.5 * f * f
    const approx = f - hfsq
    // Dekker splitting with 2^32+1 gives a high part with at most 21 bits;
    // its product with the 32-bit high part of 1/ln(2) is exact.
    const split = 0x1_0000_0001 * approx
    const hi = split - (split - approx)
    const lo = ((f - hi) - hfsq) + s * (hfsq + r)
    const valHi = hi * 1.44269504072144627571
    const valLo = (lo + hi) * 1.67517131648865118353e-10 + lo * 1.44269504072144627571
    const result = k + valHi
    const tail = valLo + ((k - result) + valHi)
    return result + tail
}

/** Math.log2: ToNumber once, then the shared numerical kernel. @type {(value?: unknown) => number} */
const log2 = value => numberLog2(toNumber(value))

/**
 * An argument as `ToIntegerOrInfinity` reads one: `ToNumber`, then `NaN`
 * made `0`, an infinity kept, and a finite number truncated toward zero,
 * its fraction dropped.
 *
 * @type {(value: unknown) => number}
 */
const integer = value => {
    const n = toNumber(value)
    return isNaN_(n) ? 0 : isFinite_(n) ? n - n % 1 : n
}

/**
 * A position argument as the string methods read one: {@link integer},
 * then clamped into the string, between `0` and its `length`.
 *
 * @type {(value: unknown, length: number) => number}
 */
const position = (value, length) => {
    const p = integer(value)
    return p < 0 ? 0 : p > length ? length : p
}

/**
 * Whether `s` is the substring of `self` at `start`, a position already
 * clamped into it. An empty `s` is found anywhere, past the end included.
 * The substring is the intrinsic `slice`, called as a function: a member
 * call would name what the runtime defines
 * ([`../intrinsic`](../intrinsic/module.f.js)).
 *
 * @type {(self: string, s: string, start: number) => boolean}
 */
const found = (self, s, start) => {
    const end = start + s.length
    return end > self.length ? false : slice(self, start, end) === s
}

/** The member table: a name, then the body of the receiver. */
export const member = {
    /**
     * `Array.prototype.map`, for an array and no other receiver type. The
     * typed body is shared with the member inventory and calls the callback
     * as a plain function, with no runtime lookup during bootstrap.
     *
     * @type {(self: unknown) => undefined | ((callback: unknown) => readonly unknown[])}
     */
    map: self => !(self instanceof Array) ? undefined : callback => arrayMap(self, callback),
    /**
     * [`String.prototype.startsWith`](https://tc39.es/ecma262/#sec-string.prototype.startswith),
     * a string's and no other type's: whether `ToString(search)` occurs
     * at `position`, clamped into the string. The search string is
     * converted before the position, as the algorithm orders them, and
     * either conversion can throw — a search whose own `toString`
     * throws, a bigint position — so the order is observable. The two
     * are a call's arguments, which every executor evaluates left to
     * right; two `const`s would be evaluated as the result demands
     * them, the position first.
     *
     * @type {(self: unknown) => undefined | ((search: unknown, at: unknown) => boolean)}
     */
    startsWith: self => typeof self !== 'string' ? undefined
        : (search, at) => found(self, String(search), position(at, self.length)),
    /**
     * [`String.prototype.codePointAt`](https://tc39.es/ecma262/#sec-string.prototype.codepointat),
     * a string's and no other type's: the code point at `at`, read as
     * `ToIntegerOrInfinity`, or `undefined` outside the string. A code
     * unit that leads a surrogate pair, followed by one that trails, is
     * the pair's code point; any other code unit, a lone surrogate
     * included, is itself. The code units are the intrinsic `charCodeAt`,
     * called as a function, the first body that reads one.
     *
     * @type {(self: unknown) => undefined | ((at: unknown) => number | undefined)}
     */
    codePointAt: self => typeof self !== 'string' ? undefined
        : at => {
            const i = integer(at)
            if (i < 0 || i >= self.length) { return undefined }
            const first = charCodeAt(self, i)
            if (first < 0xd800 || first > 0xdbff || i + 1 === self.length) { return first }
            const second = charCodeAt(self, i + 1)
            return second < 0xdc00 || second > 0xdfff ? first : (first - 0xd800) * 0x400 + (second - 0xdc00) + 0x1_0000
        },
}

/**
 * The static table: a static function's id, then the body — or, at a path
 * every executor binds natively, `Object.entries`, the built-in itself, so
 * that every admitted id holds a value and the table is complete.
 */
export const statics = {
    'Object.is': is,
    'Object.entries': Object.entries,
    'String.fromCharCode': String.fromCharCode,
    'Object.fromEntries': fromEntries,
    'Number.isInteger': isInteger,
    'Number.isSafeInteger': isSafeInteger,
    'Number.isNaN': isNaN_,
    'Number.isFinite': isFinite_,
    'Math.log2': log2,
}

/** The runtime: the three functions an executor asks, `static`, `dot` and `in`. */
export const runtime = {
    /**
     * The static function `id` names, `Object.is`: the entry of
     * {@link statics}, read as the object literal it is so that no
     * inherited name answers, or `undefined` for an id the table lacks,
     * which an executor refuses by name and never answers with — the
     * parser admits only the ids `../static` lists, so a missing one is
     * the table incomplete, not a program's error.
     *
     * @type {(id: string) => unknown}
     */
    static: id => entry(statics, id),
    /**
     * The callee of `self[key](...)`, the receiver not nullish: the
     * receiver's own enumerable property under the key — an object's
     * field, an array's or a string's element, its presence asked by
     * `hasEntry` so that an own `undefined` is found, its value read by
     * `entry` — else what the `member` body of the name answers for the
     * receiver, the function of the arguments or `undefined`, else
     * `undefined`. An own property wins whatever it holds, as it does in
     * JavaScript: `{ toString: f }` calls `f`, `{ x: undefined }.x()`
     * throws, and `[1][0]()` throws for the element. `entry(member, key)`
     * reads the table as the object literal it is, so no inherited name
     * answers, and nothing is built on the way: a receiver that owns
     * nothing under the key costs one scan, an object that owns it two.
     * A body's throw is the call's, or the guard's. The core rule of
     * DESIGN.md §13 holds here: no member call and no optional chain,
     * only the two helpers, a conditional and a plain call of a function
     * value, since an executor runs this to answer a member call. The
     * runtime's proof pins the shape on the EDAG.
     *
     * @type {(self: unknown, key: string) => unknown}
     */
    dot: (self, key) => {
        if (hasEntry(self, key)) { return entry(self, key) }
        const body = /** @type {undefined | ((self: unknown) => unknown)} */ (entry(member, key))
        return body === undefined ? undefined : body(self)
    },
    /**
     * The operator `"k" in o`, in its operand order: whether `self`, an
     * object, an array or a function, owns an enumerable entry under
     * `key`, one holding `undefined` included — `hasEntry`'s answer — or
     * the `length` an array and a function own without enumerating it,
     * which the operator reads as the read does and the helper, listing
     * what `Object.entries` lists, does not; and a throw for `null`,
     * `undefined` and every primitive, the `TypeError` JavaScript's `in`
     * throws, the receiver check `fromEntries` makes. The answer is
     * JavaScript's for the keys the parser admits, a string literal that
     * names no property a built-in prototype gives a value
     * ([`../prototype`](../prototype/module.f.js), `length` aside): such
     * a key is found nowhere but as an own property. For a
     * prototype name it would answer `false` where JavaScript finds the
     * name on the chain, which no check here can tell from a program's
     * own key, so the parser refuses those keys and this body is never
     * asked ([`2346-in-operator.md`](../../../spec/todo/2346-in-operator.md)).
     * The core rule of DESIGN.md §13 holds as in `dot`: the helper and
     * `typeof`, no member call, since an executor runs this to answer the
     * operator's node.
     *
     * @type {(key: string, self: unknown) => boolean}
     */
    in: (key, self) => {
        if (self === null || typeof self !== 'object' && typeof self !== 'function') { throw 'in: not an object' }
        return hasEntry(self, key) || key === 'length' && (self instanceof Array || typeof self === 'function')
    },
}
