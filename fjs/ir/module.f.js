/**
 * The code IR's constructors, the way a person writes a module by hand, and
 * the facts about types that the [checker](./check/module.f.js) and the
 * [emitter](./wasm/module.f.js) share. The data is
 * [`types.ts`](./types.ts)'s, and the [README](./README.md) says what a
 * module may hold so far.
 *
 * @module
 *
 * @import { ArmOf, Code, CodeParam, Defines, F64, F64c, Fn, Inline, Int, Interface, LoopParamOf, OpName, Param, Parts, Product, Sealed, SealedDef, Signature, Sum, Term, Type, Typed, TypedTerm } from './types.ts'
 */

import { assertNotNullish } from '../asserts/module.f.js'
import { entry } from '../types/object/entry/module.f.js'

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

/** A product of fields in their order. @type {(fields: Parts) => Product} */
export const product = fields => ['product', fields]

/** The product with no field. @type {Product} */
export const unit = product([])

/** The sum with no variant, the type of a term that gives no value. @type {Sum} */
export const never = ['sum', []]

/** `false`, then `true`, each holding nothing. @type {Sum} */
export const bool = ['sum', [['false', unit], ['true', unit]]]

/** The sealed type `name` of the interface `module`, all its variants. @type {(module: string, name: string) => Sealed} */
export const sealed = (module, name) => ['sealed', module, name, null]

/** The values of some variants of a sealed type: `only(any, 'number')`. @type {(t: Sealed, ...variants: readonly string[]) => Sealed} */
export const only = ([, module, name], ...variants) => ['sealed', module, name, variants]

/**
 * Whether a value of a sealed type is copy: every variant that it may hold
 * is one that its interface names as copy, so it needs no `dup` and no
 * `drop`
 * ([definition.md: Ownership](../../doc/sasha-gil/ir/definition.md#ownership-is-two-capabilities)).
 *
 * @type {(def: SealedDef, t: Sealed) => boolean}
 */
export const isCopy = ({ variants, copy = [] }, t) => (t[3] ?? variants).every(v => copy.includes(v))

/**
 * A code type: a pointer to a top-level function of these parameters and
 * this result. Each parameter is `['borrow', T]` or `['own', T]`.
 *
 * @type {(params: readonly CodeParam[], result: Type) => Code}
 */
export const code = (params, result) => ['code', params, result]

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

/** A literal: a `bigint` of an integer range, a `number` of a float, or a `string` of a sealed type that has string literals. @type {(type: Type, value: bigint | number | string) => Term} */
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

/**
 * The bit operators of two unsigned integers: `and`, `or`, `xor`, and the
 * shifts, `shl` and `shr`, by a count below 64. A shift is exact, as `mul`
 * is: `shl` is refused where its result needs more than one word.
 */
export const and = op('and')
export const or = op('or')
export const xor = op('xor')
export const shl = op('shl')
export const shr = op('shr')

/**
 * A float with any NaN replaced by the one NaN, `0x7FF8_0000_0000_0000`:
 * an `f64c`, whose bits `to_bits` may read.
 */
export const canon = op('canon')

/** The 64 bits of an `f64c`, as a `u(64)`. */
export const to_bits = op('to_bits')

/** The float of 64 bits: an `f64`, since the bits may be any NaN. */
export const from_bits = op('from_bits')

/** An integer, within ±2^53, as the float of its value. */
export const float = op('float')

/**
 * A float as an integer of `t`: truncated toward zero, then saturated to
 * `t`'s bounds, a NaN as `0` is. It never fails.
 *
 * @type {(t: Int, x: Term) => Term}
 */
export const trunc_sat = (t, x) => ['op', 'trunc_sat', [x], t]

/**
 * The bits that carry a value of a sealed type, `u(64)` for an `i64`
 * carrier and `u(32)` for an `i32`: only in the module that defines
 * the type. It borrows the value.
 *
 * @type {(x: Term) => Term}
 */
export const unseal = x => ['op', 'unseal', [x]]

/**
 * A value of the sealed type `t` from the bits that carry it: only in the
 * module that defines `t`.
 *
 * @type {(t: Sealed, x: Term) => Term}
 */
export const seal = (t, x) => ['op', 'seal', [x], t]

/**
 * The bits that carry an owned value of a sealed type, which the term takes
 * over: only in the module that defines the type, and only as the argument
 * of the type's `drop`, as the lifetime pass writes it.
 *
 * @type {(x: Term) => Term}
 */
export const release = x => ['op', 'release', [x]]

/** The name of the sealed types that a module defines, or `null` where it defines none. @type {(m: { readonly defines?: Defines }) => string | null} */
export const definedBy = ({ defines }) => defines === undefined ? null : assertNotNullish(entry(defines, 'name'))

/**
 * The interfaces whose types a module's terms name: those it imports, then
 * the one it defines, if any, whose functions are those of the module that
 * its types' `kind` names.
 *
 * @type {(m: { readonly imports: readonly (readonly [string, Interface])[], readonly defines?: Defines, readonly functions: readonly (readonly [string, Signature])[] }) => readonly (readonly [string, Interface])[]}
 */
export const interfacesOf = ({ imports, defines, functions }) => {
    if (defines === undefined) { return imports }
    const hooks = defines.types.flatMap(([, { kind }]) => kind === undefined ? [] : [kind])
    const name = assertNotNullish(definedBy({ defines }))
    /** @type {Interface} */
    const own = { abi: name, types: defines.types, functions: functions.filter(([k], j) => hooks.includes(k) && functions.findIndex(([x]) => x === k) === j).map(([k, { params, result }]) => /** @type {const} */ ([k, { params, result }])) }
    return [...imports, [name, own]]
}

/** A function of a module, `self` for the module itself. @type {(module: string, name: string, args: readonly Term[]) => Term} */
export const call = (module, name, args) => ['call', module, name, args]

/** A top-level function of the module as a value. @type {(name: string) => Term} */
export const codeOf = name => ['code', name]

/** An indirect call of a code value. @type {(c: Term, args: readonly Term[]) => Term} */
export const call_ref = (c, args) => ['call_ref', c, args]

/** A product from its fields. @type {(fields: readonly (readonly [string, Term])[]) => Term} */
export const make = fields => ['make', fields]

/**
 * A constant, borrowed: one of the module's own, `self`, or one of an
 * interface that it imports, `constant('Any', 'undefined')`.
 *
 * @type {(module: string, name: string) => Term}
 */
export const constant = (module, name) => ['constant', module, name]

/** A field of a product, by its name. @type {(e: Term, name: string) => Term} */
export const field = (e, name) => ['field', e, name]

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

/**
 * A trap where only a bug of the caller leads, or memory that cannot grow:
 * a count of 0, bits that are no value. It traps as `trap` does, and the
 * checker does not count it as failing, as L0's traps on misuse declare
 * nothing ([L0 design §11](../../doc/sasha-gil/wasm/l0-design.md#11-misuse-traps-and-only-calls-fail)).
 *
 * @type {(reason: string) => Term}
 */
export const misuse = reason => ['trap', reason, 'misuse']

/** A throw of `v`, which `Functions.throw` takes over: a term of type `never`. @type {(v: Term) => Term} */
export const throw_ = v => call('Functions', 'throw', [v])

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
 * `name`, and `otherwise`, a trap unless it is given, where the float holds
 * none: a fraction, a NaN or an infinity, or a value outside `t`. `-0`
 * holds `0`. A float that is no local or literal is bound first, to
 * `name.float`. `t` is within ±2^53, as `float` needs.
 *
 * @type {(t: Int, x: Term, name: string, body: (k: Term) => Term, otherwise?: Term) => Term}
 */
export const exact = (t, x, name, body, otherwise = trap('inexact')) => {
    /** @type {(y: Term) => Term} */
    const test = y => let_(name, trunc_sat(t, y), k => if_(eq(float(k), y), body(k), otherwise))
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

/**
 * A function with an inline hint: `hint('always', fn(...))` asks the
 * [inline pass](./inline/module.f.js) to write its body at every call.
 *
 * @type {(inline: Inline, f: Fn) => Fn}
 */
export const hint = (inline, f) => ({ ...f, inline })

/**
 * What a call of a function needs, written apart from its body, and for a
 * function of an interface that gives back a parameter that it owns, the
 * parameter's name, `returns`.
 *
 * @type {(params: readonly Param[], result: Type, returns?: string) => Signature}
 */
export const signature = (params, result, returns) => returns === undefined ? { params, result } : { params, result, returns }

/**
 * A signature of an interface's function that may fail, by a throw or a
 * trap, as [definition.md](../../doc/sasha-gil/ir/definition.md#one-effect)
 * marks it: `mayFail(signature([own('v', any)], never))` is `Functions.throw`.
 *
 * @type {(s: Signature) => Signature}
 */
export const mayFail = s => ({ ...s, fails: true })

/**
 * A signature of an interface's function that counts a value on its bits:
 * `dup` or `drop`, which only that hook of a counted type that the module
 * defines calls, or `new`, whose bits only a `seal` of such a type takes.
 *
 * @type {(counts: 'dup' | 'drop' | 'new', s: Signature) => Signature}
 */
export const countsBits = (counts, s) => ({ ...s, counts })

/**
 * A parameter the callee owns: `own('v', any)`. A plain `[name, type]` still
 * borrows.
 *
 * @type {(name: string, type: Type) => Param}
 */
export const own = (name, type) => [name, type, 'own']

/** Whether a parameter is owned. @type {(p: Param) => boolean} */
export const isOwn = ([, , mode]) => mode === 'own'

// the parts of a term

/** The terms that a term holds, in their order. @type {(t: Term) => readonly Term[]} */
export const terms = t => {
    switch (t[0]) {
        case 'let': { return [t[2], t[3]] }
        case 'op': { return t[2] }
        case 'call': { return t[3] }
        case 'call_ref': { return [t[1], ...t[2]] }
        case 'make': { return t[1].map(([, x]) => x) }
        case 'field': { return [t[1]] }
        case 'variant': case 'block': { return [t[3]] }
        case 'match': { return [t[1], ...t[2].map(([, , x]) => x)] }
        case 'loop': { return [...t[2].map(([, , x]) => x), t[3]] }
        case 'br': { return [t[2]] }
        default: { return [] }
    }
}

/** The typed terms that a typed term holds, in their order, as `terms` reads a term. @type {(t: TypedTerm) => readonly Typed[]} */
export const inside = t => {
    switch (t[0]) {
        case 'let': { return [t[2], t[3]] }
        case 'op': { return t[2] }
        case 'call': { return t[3] }
        case 'call_ref': { return [t[1], ...t[2]] }
        case 'make': { return t[1].map(([, x]) => x) }
        case 'field': { return [t[1]] }
        case 'variant': case 'block': { return [t[3]] }
        case 'match': { return [t[1], ...t[2].map(([, , x]) => x)] }
        case 'loop': { return [...t[2].map(([, , x]) => x), t[3]] }
        case 'br': { return [t[2]] }
        default: { return [] }
    }
}

/**
 * The labels that a typed term may leave to, by a `br` that no `block` or
 * `loop` inside it binds the label of: `return`, or a region around it.
 *
 * @type {(t: Typed) => readonly string[]}
 */
export const leaves = ([, t]) => {
    const inner = inside(t).flatMap(leaves)
    return t[0] === 'br' ? [t[1], ...inner]
        : t[0] === 'block' || t[0] === 'loop' ? inner.filter(l => l !== t[1])
        : inner
}
