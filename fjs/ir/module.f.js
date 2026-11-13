/**
 * The code IR's constructors, the way a person writes a module by hand, and
 * the facts about types that the [checker](./check/module.f.mjs) and the
 * [emitter](./wasm/module.f.js) share. The data is
 * [`types.ts`](./types.ts)'s, and the [README](./README.md) says what a
 * module may hold so far.
 *
 * @module
 *
 * @import { ArmOf, F64, F64c, Fn, Int, LoopParamOf, OpName, Param, Product, Sealed, Signature, Sum, Term, Type } from './types.ts'
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

/** The sealed type `name` of the interface `module`, all its variants. @type {(module: string, name: string) => Sealed} */
export const sealed = (module, name) => ['sealed', module, name, null]

/** The values of some variants of a sealed type: `only(any, 'number')`. @type {(t: Sealed, ...variants: readonly string[]) => Sealed} */
export const only = ([, module, name], ...variants) => ['sealed', module, name, variants]

/**
 * Whether two values of the IR's data are the same: equal strings, numbers
 * and bigints, and tuples of the same parts. A type is recognized by this,
 * never by the names in it.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const equal = (a, b) => a instanceof Array && b instanceof Array
    ? a.length === b.length && a.every((x, k) => equal(x, b[Number(k)]))
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

/**
 * A float as an integer of `t`: truncated toward zero, then saturated to
 * `t`'s bounds, a NaN as `0` is. It never fails.
 *
 * @type {(t: Int, x: Term) => Term}
 */
export const trunc_sat = (t, x) => ['op', 'trunc_sat', [x], t]

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

/**
 * A loop: `body`, which is a term or a function of the parameters' locals
 * in their order, repeated with the parameters that a `br` to `label`
 * gives.
 *
 * @type {(label: string, params: readonly LoopParamOf<Term>[], body: Term | ((...xs: readonly Term[]) => Term)) => Term}
 */
export const loop = (label, params, body) => ['loop', label, params, typeof body === 'function' ? body(...params.map(([name]) => get(name))) : body]

/** @type {(label: string, e: Term) => Term} */
export const br = (label, e) => ['br', label, e]

/** @type {(reason: string) => Term} */
export const trap = reason => ['trap', reason]

// what a producer may write, and what it stands for

/** `match(c, { true: a, false: b })`. @type {(c: Term, a: Term, b: Term) => Term} */
export const if_ = (c, a, b) => match(c, [[['true'], null, a], [['false'], null, b]])

/** @type {(b: Term) => Term} */
export const not = b => if_(b, false_, true_)

/** @type {(a: Term, b: Term) => Term} */
export const ne = (a, b) => not(eq(a, b))

/** @type {(e: Term) => Term} */
export const return_ = e => br('return', e)

/** The next round of a loop: `br` to its label with the next values of its parameters, by their names. @type {(label: string, fields: readonly (readonly [string, Term])[]) => Term} */
export const next = (label, fields) => br(label, make(fields))

/**
 * `body` of the integer of `t` that a float holds exactly, which is bound to
 * `name`, and a trap where the float holds none: a fraction, a NaN or an
 * infinity, or a value outside `t`. `-0` holds `0`. A float that is no
 * local or literal is bound first, to `name.float`. `t` is within ±2^53, as
 * `float` needs.
 *
 * @type {(t: Int, x: Term, name: string, body: (k: Term) => Term) => Term}
 */
export const exact = (t, x, name, body) => {
    /** @type {(y: Term) => Term} */
    const test = y => let_(name, trunc_sat(t, y), k => if_(eq(float(k), y), body(k), trap('inexact')))
    return x[0] === 'get' || x[0] === 'lit' ? test(x) : let_(`${name}.float`, x, test)
}

/**
 * A cast: `e`, as `name` in `body`, where it holds a value of `t`'s
 * variants, and a trap where it holds another. A cast to every variant is
 * no test, so it is a `let`. `body` is a term, or a function of the local.
 *
 * @type {(t: Sealed, e: Term, name: string, body: Term | ((x: Term) => Term)) => Term}
 */
export const cast = (t, e, name, body) => {
    const b = typeof body === 'function' ? body(get(name)) : body
    const variants = t[3]
    return variants === null ? let_(name, e, b) : match(e, [[variants, name, b], [null, null, trap(`not ${variants.join(' or ')}`)]])
}

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

/** What a call of a function needs, written apart from its body. @type {(params: readonly Param[], result: Type) => Signature} */
export const signature = (params, result) => ({ params, result })
