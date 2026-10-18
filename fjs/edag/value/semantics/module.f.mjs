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
 * @import { EdagValue, Function as ValueFunction } from '../types.ts'
 * @import { ConstructorId } from '../../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok } from '../../../types/result/module.f.js'
import { isStatic } from '../../module.f.mjs'

/** Untags undefined for primitive operations, retaining every other value. @param {EdagValue} value */
export const untagUndefined = value => isArray(value) && value[0] === 'undefined' ? undefined : value

/** JavaScript truthiness of the represented value. @type {(value: EdagValue) => boolean} */
export const truthy = value => Boolean(untagUndefined(value))

/**
 * Whether a value is a function: a closure, the `entry` helper, or a
 * static function, `Object.is`.
 *
 * @type {(value: EdagValue) => value is ValueFunction}
 */
export const isFunction = value => isArray(value) && (value[0] === '=>' || value[0] === 'entry' || isStatic(value))

/** JavaScript typeof of the represented value. @type {(value: EdagValue) => string} */
export const typeOf = value => isFunction(value) ? 'function' : typeof untagUndefined(value)

/**
 * Whether two values are one static function: a built-in is identified by
 * its name, so two reads of `Object.is` are one function however they are
 * read, as NaNVM compares the names of its built-ins.
 *
 * @type {(a: EdagValue, b: EdagValue) => boolean}
 */
const sameStatic = (a, b) => isStatic(a) && isStatic(b) && a[0] === b[0]

/** Strict equality, with containers and closures compared by identity and static functions by name. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const strictEqual = (a, b) => sameStatic(a, b) || untagUndefined(a) === untagUndefined(b)

/** SameValue, for `includes`'s SameValueZero: NaN equals itself and signed zeroes differ. @type {(a: EdagValue, b: EdagValue) => boolean} */
export const is = (a, b) => sameStatic(a, b) || Object.is(untagUndefined(a), untagUndefined(b))

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
