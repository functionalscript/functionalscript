/**
 * Basic semantics of evaluated EDAG values: truthiness, type classification
 * and equality. Tagged undefined has primitive semantics; represented arrays,
 * objects and functions retain their node identities.
 *
 * The helpers and operation tables consume valid EdagValue forms without
 * evaluating code or materializing runtime values. The unary and binary
 * tables return Result successes; callers own operand evaluation and
 * failure propagation.
 *
 * @module
 * @import { EdagValue, Function as ValueFunction } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok } from '../../../types/result/module.f.mjs'

/** Untags undefined for primitive operations, retaining every other value. @param {EdagValue} value */
export const untagUndefined = value => isArray(value) && value[0] === 'undefined' ? undefined : value

/** JavaScript truthiness of the represented value. @type {(value: EdagValue) => boolean} */
export const truthy = value => Boolean(untagUndefined(value))

/**
 * Whether a value is a function: a closure, or the `entry` helper.
 *
 * @type {(value: EdagValue) => value is ValueFunction}
 */
export const isFunction = value => isArray(value) && (value[0] === '=>' || value[0] === 'entry')

/** JavaScript typeof of the represented value. @type {(value: EdagValue) => string} */
export const typeOf = value => isFunction(value) ? 'function' : typeof untagUndefined(value)

/** Strict equality, with containers and functions compared by identity. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const strictEqual = (a, b) => untagUndefined(a) === untagUndefined(b)

/** SameValue: NaN equals itself and signed zeroes differ. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const is = (a, b) => Object.is(untagUndefined(a), untagUndefined(b))

/** @type {Readonly<Record<'!' | 'typeof', (value: EdagValue) => Result<boolean | string, EdagValue>>>} */
export const unary = {
    '!': value => ok(!truthy(value)),
    typeof: value => ok(typeOf(value)),
}

/** @type {Readonly<Record<'===' | '!==' | 'is', (a: EdagValue, b: EdagValue) => Result<boolean, EdagValue>>>} */
export const binary = {
    '===': (a, b) => ok(strictEqual(a, b)),
    '!==': (a, b) => ok(!strictEqual(a, b)),
    is: (a, b) => ok(is(a, b)),
}
