/**
 * The FunctionalScript view of L0, the core of the WASM runtime interface
 * ([`l0-design.md` §17](../../../../doc/sasha-gil/wasm/l0-design.md#17-a-functionalscript-view-of-l0)):
 * the L0 functions FunctionalScript code may call, the kind tags, and the
 * casts, each with a plain JavaScript body. The WASM backend will recognise
 * each function by its body and lower it to its `fjs:l0` import, or a cast
 * to `to_f64`, `to_bool` or nothing. Until that backend exists, the bodies
 * run as they are, so code written over the view, the L1 bodies first, runs
 * and is proved on any JavaScript host.
 *
 * Each body checks the preconditions the L0 function has: where WASM traps,
 * the body throws. A cast throws unless the value has its kind, and an
 * argument that is an `i32` in WASM must be an integer in range. A proof on
 * a JavaScript host therefore finds every misuse that would trap. The text
 * thrown is `l0.<name>: <reason>`; a trap carries no value, so the text is
 * only for whoever reads a failed proof.
 *
 * Only `fjs/wasm/runtime/l1` imports this view, and only the WASM backend will read
 * it. The interpreter and the Rust backend never see it, and
 * [`fjs/js/runtime`](../../../js/runtime/module.f.js) stays as it is.
 *
 * Allocation, `dup`, `drop`, the builders and memory are not in the view:
 * the compiler emits them from literals, spreads and its ownership pass.
 *
 * @module
 *
 * @import { Cast, Kind, L0Array, L0Function, L0Object } from './types.ts'
 */

import { charCodeAt, slice } from '../../../js/intrinsic/module.f.js'

/** The kind tag of `undefined`. @type {Kind} */
export const UNDEFINED = 0

/** The kind tag of `null`. @type {Kind} */
export const NULL = 1

/** The kind tag of a boolean. @type {Kind} */
export const BOOLEAN = 2

/** The kind tag of a number. @type {Kind} */
export const NUMBER = 3

/** The kind tag of a string. @type {Kind} */
export const STRING = 4

/** The kind tag of a bigint. @type {Kind} */
export const BIGINT = 5

/** The kind tag of an array. @type {Kind} */
export const ARRAY = 6

/** The kind tag of an object. @type {Kind} */
export const OBJECT = 7

/** The kind tag of a function. @type {Kind} */
export const FUNCTION = 8

/**
 * L0 `kind`: the tag of a value's kind. A JavaScript value that is no
 * FunctionalScript value, such as a symbol, throws.
 *
 * @type {(v: unknown) => Kind}
 */
export const kind = v => {
    if (v === undefined) { return UNDEFINED }
    if (v === null) { return NULL }
    const t = typeof v
    if (t === 'boolean') { return BOOLEAN }
    if (t === 'number') { return NUMBER }
    if (t === 'string') { return STRING }
    if (t === 'bigint') { return BIGINT }
    if (t === 'function') { return FUNCTION }
    if (t !== 'object') { throw 'l0.kind: not a FunctionalScript value' }
    return v instanceof Array ? ARRAY : OBJECT
}

/**
 * A cast to a number, which lowers to L0 `to_f64`.
 *
 * @type {Cast<number>}
 */
export const asNumber = v => {
    if (typeof v !== 'number') { throw 'l0.asNumber: not a number' }
    return v
}

/**
 * A cast to a boolean, which lowers to L0 `to_bool`.
 *
 * @type {Cast<boolean>}
 */
export const asBoolean = v => {
    if (typeof v !== 'boolean') { throw 'l0.asBoolean: not a boolean' }
    return v
}

/**
 * A cast to a string. It lowers to nothing: the value stays an `any`
 * whose kind the compiler knows.
 *
 * @type {Cast<string>}
 */
export const asString = v => {
    if (typeof v !== 'string') { throw 'l0.asString: not a string' }
    return v
}

/**
 * A cast to a bigint, which lowers to nothing.
 *
 * @type {Cast<bigint>}
 */
export const asBigInt = v => {
    if (typeof v !== 'bigint') { throw 'l0.asBigInt: not a bigint' }
    return v
}

/**
 * A cast to an array, which lowers to nothing.
 *
 * @type {Cast<L0Array>}
 */
export const asArray = v => {
    if (kind(v) !== ARRAY) { throw 'l0.asArray: not an array' }
    return /** @type {L0Array} */ (v)
}

/**
 * A cast to an object, which lowers to nothing. An array is not an object
 * here: its kind is its own.
 *
 * @type {Cast<L0Object>}
 */
export const asObject = v => {
    if (kind(v) !== OBJECT) { throw 'l0.asObject: not an object' }
    return /** @type {L0Object} */ (v)
}

/**
 * A cast to a function, which lowers to nothing. A call of the result
 * lowers to L0 `call`.
 *
 * @type {Cast<L0Function>}
 */
export const asFunction = v => {
    if (kind(v) !== FUNCTION) { throw 'l0.asFunction: not a function' }
    return /** @type {L0Function} */ (v)
}

/**
 * An `i32` argument that indexes `n` positions: an integer from `0` to
 * `n - 1`, or a throw naming the function.
 *
 * @type {(name: string, i: unknown, n: number) => number}
 */
const index = (name, i, n) => {
    if (typeof i !== 'number' || i % 1 !== 0 || i < 0 || i >= n) { throw 'l0.' + name + ': not an index' }
    return i
}

/**
 * The number of `u64` words of a bigint's magnitude: `0` for `0n`, since
 * bigints are canonical
 * ([`l0-design.md` §19](../../../../doc/sasha-gil/wasm/l0-design.md#19-bigints-are-canonical)).
 *
 * @type {(b: bigint) => number}
 */
const words = b => {
    let s = { rest: b < 0n ? -b : b, n: 0 }
    while (s.rest !== 0n) {
        s = { rest: s.rest >> 64n, n: s.n + 1 }
    }
    return s.n
}

/**
 * The properties of an object in order, as `[key, value]` pairs.
 *
 * @type {(name: string, o: unknown) => readonly (readonly [string, unknown])[]}
 */
const properties = (name, o) => {
    if (kind(o) !== OBJECT) { throw 'l0.' + name + ': not an object' }
    return Object.entries(/** @type {L0Object} */ (o))
}

/**
 * L0 `length`, per kind
 * ([`l0-design.md` §18](../../../../doc/sasha-gil/wasm/l0-design.md#18-what-length-item-and-key-mean-for-each-kind)):
 * a string's UTF-16 units, a bigint's `u64` words, an array's items, an
 * object's properties, and a function's declared parameters. `undefined`,
 * `null`, a boolean and a number throw.
 *
 * @type {(v: unknown) => number}
 */
export const length = v => {
    const k = kind(v)
    if (k === STRING) { return asString(v).length }
    if (k === BIGINT) { return words(asBigInt(v)) }
    if (k === ARRAY) { return asArray(v).length }
    if (k === FUNCTION) { return asFunction(v).length }
    return properties('length', v).length
}

/**
 * L0 `item`: the item `i` of an array, or the value of the property `i` of
 * an object. Any other kind throws, and so does an `i` that is not an index.
 *
 * @type {(v: unknown, i: unknown) => unknown}
 */
export const item = (v, i) => {
    if (kind(v) === ARRAY) {
        const a = asArray(v)
        return a[Number(index('item', i, a.length))]
    }
    const p = properties('item', v)
    return p[Number(index('item', i, p.length))][1]
}

/**
 * L0 `key`: the key of the property `i` of an object. Any other kind
 * throws, an array too.
 *
 * @type {(o: unknown, i: unknown) => string}
 */
export const key = (o, i) => {
    const p = properties('key', o)
    return p[Number(index('key', i, p.length))][0]
}

/**
 * L0 `find`: the index of the property `k` of an object, or `-1`. The key
 * must be a string: L1 converts it first.
 *
 * @type {(o: unknown, k: unknown) => number}
 */
export const find = (o, k) => {
    const p = properties('find', o)
    if (typeof k !== 'string') { throw 'l0.find: not a string' }
    let i = 0
    while (i < p.length && p[Number(i)][0] !== k) {
        i = i + 1
    }
    return i < p.length ? i : -1
}

/**
 * Whether `v` is an array, an object or a function.
 *
 * @type {(v: unknown) => boolean}
 */
const isReference = v => {
    const k = kind(v)
    return k === ARRAY || k === OBJECT || k === FUNCTION
}

/**
 * L0 `same`: whether two arrays, objects or functions are the same value.
 * Any other kind throws: L1 compares primitives by content. A runtime may
 * also answer `true` for two equal values
 * ([`l0-design.md` §14](../../../../doc/sasha-gil/wasm/l0-design.md#14-identity-same-is-reference-identity-and-a-runtime-may-merge-equal-values)),
 * which a JavaScript host does not.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const same = (a, b) => {
    if (!isReference(a) || !isReference(b)) { throw 'l0.same: not an array, an object or a function' }
    return a === b
}

/**
 * L0 `text`: the source text of a function. A JavaScript host always has
 * one, where a WASM runtime may answer `undefined`.
 *
 * @type {(f: unknown) => string | undefined}
 */
export const text = f => asFunction(f).toString()

/**
 * L0 `unit`: the UTF-16 unit `i` of a string, which must be an index.
 *
 * @type {(s: unknown, i: unknown) => number}
 */
export const unit = (s, i) => {
    const t = asString(s)
    return charCodeAt(t, index('unit', i, t.length))
}

/**
 * L0 `from_unit`: the string of one UTF-16 unit, an integer from `0` to
 * `0xffff`.
 *
 * @type {(u: unknown) => string}
 */
export const fromUnit = u => String.fromCharCode(index('fromUnit', u, 0x1_0000))

/**
 * L0 `concat`: two strings joined.
 *
 * @type {(a: unknown, b: unknown) => string}
 */
export const concat = (a, b) => asString(a) + asString(b)

/**
 * L0 `substring`: the units of `s` from `start` up to `end`, where
 * `0 <= start <= end <= length`. Unlike `slice`, it neither clamps nor
 * counts from the end: anything else throws.
 *
 * @type {(s: unknown, start: unknown, end: unknown) => string}
 */
export const substring = (s, start, end) => {
    const t = asString(s)
    const e = index('substring', end, t.length + 1)
    return slice(t, index('substring', start, e + 1), e)
}
