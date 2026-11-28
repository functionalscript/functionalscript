/**
 * Basic semantics of evaluated EDAG values: truthiness, type classification
 * and strict equality. Tagged undefined has primitive semantics; represented arrays,
 * objects and closures retain their node identities, and a static function
 * is identified by its name.
 *
 * The helpers and operation tables consume valid EdagValue forms without
 * evaluating code or materializing runtime values. The unary and binary
 * tables return Result successes; callers own operand evaluation and
 * failure propagation.
 *
 * @module
 * @import { EdagValue, Property, Function as ValueFunction } from '../types.ts'
 * @import { _StructEqStack } from '../../../types/object/struct_eq/private.ts'
 * @import { ConstructorId } from '../../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { isHelper, isStatic } from '../../module.f.js'

/** Untags undefined for primitive operations, retaining every other value. @param {EdagValue} value */
export const untagUndefined = value => isArray(value) && value[0] === 'undefined' ? undefined : value

/**
 * Tags a slot JavaScript reads as `undefined` — a missing argument, element
 * or property — as EDAG's undefined: the inverse of {@link untagUndefined}.
 *
 * @type {<T>(value: T) => (T & ({} | null)) | readonly ['undefined']}
 */
export const tagUndefined = value => value === undefined ? ['undefined'] : value

/** JavaScript truthiness of the represented value. @type {(value: EdagValue) => boolean} */
export const truthy = value => Boolean(untagUndefined(value))

/**
 * Whether a value is a function: a closure, a helper (`entry`, `slice`),
 * or a static function, `Object.is`.
 *
 * @type {(value: EdagValue) => value is ValueFunction}
 */
export const isFunction = value => isArray(value) && (value[0] === '=>' || value[0] === 'fn' || isHelper(value) || isStatic(value))

/** JavaScript typeof of the represented value. @type {(value: EdagValue) => string} */
export const typeOf = value => isFunction(value) ? 'function' : typeof untagUndefined(value)

/** Whether a value is `undefined`, tagged or absent: an argument not given reads as one. @type {(value: EdagValue) => boolean} */
export const isUndefined = value => typeOf(value) === 'undefined'

/** Whether a value is `null` or `undefined`: what `??` and `?.` step past. @type {(value: EdagValue) => boolean} */
export const isNullish = value => value === null || isUndefined(value)

/**
 * Whether two values name one group member or static function. A member
 * is identified by its group and index. A built-in is identified by
 * its name, so two reads of `Object.is` are one function however they are
 * read, as NaNVM compares the names of its built-ins.
 *
 * @type {(a: EdagValue, b: EdagValue) => boolean}
 */
const sameFunction = (a, b) => isStatic(a) && isStatic(b) && a[0] === b[0] ||
    isArray(a) && a[0] === 'fn' && isArray(b) && b[0] === 'fn' && a[1] === b[1] && a[2] === b[2]

/** Strict equality, with containers and closures compared by identity and static functions by name. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const strictEqual = (a, b) => sameFunction(a, b) || untagUndefined(a) === untagUndefined(b)

/** SameValue, for `includes`'s SameValueZero: NaN equals itself and signed zeroes differ. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const is = (a, b) => sameFunction(a, b) || Object.is(untagUndefined(a), untagUndefined(b))

/** @type {Readonly<Record<'!' | 'typeof', (value: EdagValue) => Result<boolean | string, EdagValue>>>} */
export const unary = {
    '!': value => ok(!truthy(value)),
    typeof: value => ok(typeOf(value)),
}

/**
 * `x instanceof c` for each constructor the EDAG names, over represented
 * values: an array is its own tag, `['[]', values]`, which is the one test
 * `Array` needs — `typeOf` tells only a function apart. Never throws, so
 * it answers a `boolean` rather than a `Result`.
 *
 * @type {Readonly<Record<ConstructorId, (value: EdagValue) => boolean>>}
 */
export const instanceOf = {
    Array: value => isArray(value) && value[0] === '[]',
}

/** @type {Readonly<Record<'===' | '!==', (a: EdagValue, b: EdagValue) => Result<boolean, EdagValue>>>} */
export const binary = {
    '===': (a, b) => ok(strictEqual(a, b)),
    '!==': (a, b) => ok(!strictEqual(a, b)),
}

/** Ordered content comparison over evaluated values. Object metadata is
 * already in enumeration order. Functions are leaves decided by SameValue.
 * @type {(a: EdagValue, b: EdagValue) => boolean} */
export const structEq = (a, b) => {
    /** @type {_StructEqStack<EdagValue, Property>} */
    let pending = { tag: 'value', a, b, n: undefined }
    while (pending !== undefined) {
        /** @type {NonNullable<_StructEqStack<EdagValue, Property>>} */
        const frame = pending
        pending = frame.n
        if (frame.tag !== 'value') {
            const i = frame.i
            if (i === frame.a.length) { continue }
            /** @type {_StructEqStack<EdagValue, Property>} */
            const next = i + 1 === frame.a.length ? pending : { ...frame, i: i + 1 }
            if (frame.tag === 'array') {
                pending = { tag: 'value', a: frame.a[Number(i)], b: frame.b[Number(i)], n: next }
            } else {
                const left = frame.a[Number(i)]
                const right = frame.b[Number(i)]
                if (left[1] !== right[1]) { return false }
                pending = { tag: 'value', a: left[2], b: right[2], n: next }
            }
            continue
        }
        const x = frame.a
        const y = frame.b
        if (is(x, y)) { continue }
        if (!isArray(x) || !isArray(y)) { return false }
        if (x[0] === '[]' && y[0] === '[]') {
            if (x[1].length !== y[1].length) { return false }
            pending = { tag: 'array', a: x[1], b: y[1], i: 0, n: pending }
        } else {
            if (x[0] !== '{}' || y[0] !== '{}' || x[1].length !== y[1].length) { return false }
            pending = { tag: 'object', a: x[1], b: y[1], i: 0, n: pending }
        }
    }
    return true
}
