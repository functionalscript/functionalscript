/**
 * Basic semantics of evaluated EDAG values: truthiness, type classification
 * and equality. Tagged undefined has primitive semantics; represented arrays,
 * objects and functions retain their node identities.
 *
 * These infallible helpers consume valid EdagValue forms. VM operations can
 * reuse them without evaluating code or materializing runtime values.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'

/** Untags undefined for primitive operations, retaining every other value. @param {EdagValue} value */
export const untagUndefined = value => isArray(value) && value[0] === 'undefined' ? undefined : value

/** JavaScript truthiness of the represented value. @type {(value: EdagValue) => boolean} */
export const truthy = value => Boolean(untagUndefined(value))

/** JavaScript typeof of the represented value. @type {(value: EdagValue) => string} */
export const typeOf = value => isArray(value) && value[0] === '=>' ? 'function' : typeof untagUndefined(value)

/** Strict equality, with containers and functions compared by identity. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const strictEqual = (a, b) => untagUndefined(a) === untagUndefined(b)

/** SameValue: NaN equals itself and signed zeroes differ. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const is = (a, b) => Object.is(untagUndefined(a), untagUndefined(b))
