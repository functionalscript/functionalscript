/**
 * The code IR's constructors, the way a person writes a module by hand, and
 * the facts about types that the [checker](./check/module.f.mjs) and the
 * [emitter](./wasm/module.f.mjs) share. The data is
 * [`types.ts`](./types.ts)'s, and the [README](./README.md) says what a
 * module may hold so far.
 *
 * @module
 *
 * @import { ArmOf, F64, F64c, Fn, Int, OpName, Param, Product, Sum, Term, Type } from './types.ts'
 */

// types

/** The integers from `lo` to `hi`. @type {(lo: bigint, hi: bigint) => Int} */
export const int = (lo, hi) => ['int', lo, hi]

/** The unsigned integers of `n` bits. @type {(n: number) => Int} */
export const u = n => int(0n, (1n << BigInt(n)) - 1n)

/** The two's-complement integers of `n` bits. @type {(n: number) => Int} */
export const i = n => int(-(1n << BigInt(n - 1)), (1n << BigInt(n - 1)) - 1n)

/** @type {F64} */
export const f64 = ['f64']

/** @type {F64c} */
export const f64c = ['f64c']

/** The product with no field. @type {Product} */
export const unit = ['product', []]

/** The sum with no variant, the type of a term that gives no value. @type {Sum} */
export const never = ['sum', []]

/** `false`, then `true`, each holding nothing. @type {Sum} */
export const bool = ['sum', [['false', unit], ['true', unit]]]

/**
 * Whether two values of the IR's data are the same: equal strings, numbers
 * and bigints, and tuples of the same parts. A type is recognized by this,
 * never by the names in it.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const equal = (a, b) => a instanceof Array && b instanceof Array
    ? a.length === b.length && a.every((x, k) => equal(x, b[k]))
    : a === b

/**
 * Whether a range fits a word of `n` bits read as two's complement.
 *
 * @type {(n: number) => (t: Int) => boolean}
 */
const twos = n => ([, lo, hi]) => -(1n << BigInt(n - 1)) <= lo && hi < 1n << BigInt(n - 1)

/**
 * Whether a range fits a word of `n` bits: read as unsigned when it holds no
 * negative integer, else as two's complement. A range in a word is read the
 * way it fits.
 *
 * @type {(n: number) => (t: Int) => boolean}
 */
export const fits = n => t => t[1] >= 0n ? t[2] < 1n << BigInt(n) : twos(n)(t)

/**
 * The word in which two ranges compare exactly: unsigned when neither holds
 * a negative integer, else signed, and 32 bits wide where both fit there.
 * `null` where no word of 64 bits holds both, as for `u(64)` and `i(64)`.
 *
 * @type {(a: Int, b: Int) => { readonly bits: 32 | 64, readonly signed: boolean } | null}
 */
export const compareIn = (a, b) => {
    const signed = a[1] < 0n || b[1] < 0n
    const fit = signed ? twos : fits
    return fit(32)(a) && fit(32)(b) ? { bits: 32, signed }
        : fit(64)(a) && fit(64)(b) ? { bits: 64, signed }
        : null
}

// terms

/** A literal: a `bigint` of an integer range, or a `number` of a float. @type {(type: Type, value: bigint | number) => Term} */
export const lit = (type, value) => ['lit', type, value]

/** An integer literal whose type holds its value alone. @type {(value: bigint) => Term} */
export const n = value => lit(int(value, value), value)

/** @type {(name: string) => Term} */
export const get = name => ['get', name]

/**
 * `e` bound to `name` in `body`, which is a term or a function of the local.
 *
 * @type {(name: string, e: Term, body: Term | ((x: Term) => Term)) => Term}
 */
export const let_ = (name, e, body) => ['let', name, e, typeof body === 'function' ? body(get(name)) : body]

/** @type {(name: OpName) => (...args: readonly Term[]) => Term} */
const op = name => (...args) => ['op', name, args]

export const add = op('add')
export const sub = op('sub')
export const mul = op('mul')
export const div = op('div')
export const neg = op('neg')
export const abs = op('abs')
export const sqrt = op('sqrt')
export const eq = op('eq')
export const lt = op('lt')
export const le = op('le')

/** An integer, within ±2^53, as the float of its value. */
export const float = op('float')

/** A function of a module, `self` for the module itself. @type {(module: string, name: string, args: readonly Term[]) => Term} */
export const call = (module, name, args) => ['call', module, name, args]

/** A product from its fields. @type {(fields: readonly (readonly [string, Term])[]) => Term} */
export const make = fields => ['make', fields]

/** A value of a sum: a variant and its payload. @type {(type: Type, name: string, payload: Term) => Term} */
export const variant = (type, name, payload) => ['variant', type, name, payload]

export const true_ = variant(bool, 'true', make([]))

export const false_ = variant(bool, 'false', make([]))

/** @type {(e: Term, arms: readonly ArmOf<Term>[]) => Term} */
export const match = (e, arms) => ['match', e, arms]

/** @type {(label: string, type: Type, body: Term) => Term} */
export const block = (label, type, body) => ['block', label, type, body]

/** @type {(label: string, e: Term) => Term} */
export const br = (label, e) => ['br', label, e]

// what a producer may write, and what it stands for

/** `match(c, { true: a, false: b })`. @type {(c: Term, a: Term, b: Term) => Term} */
export const if_ = (c, a, b) => match(c, [[['true'], null, a], [['false'], null, b]])

/** @type {(b: Term) => Term} */
export const not = b => if_(b, false_, true_)

/** @type {(a: Term, b: Term) => Term} */
export const ne = (a, b) => not(eq(a, b))

/** @type {(e: Term) => Term} */
export const return_ = e => br('return', e)

/**
 * A function. `body` is a term, or a function of the parameters' locals in
 * their order.
 *
 * @type {(params: readonly Param[], result: Type, body: Term | ((...xs: readonly Term[]) => Term)) => Fn}
 */
export const fn = (params, result, body) => ({
    params,
    result,
    body: typeof body === 'function' ? body(...params.map(([name]) => get(name))) : body,
})
