/**
 * Shape schemas for evaluated EDAG values: data and functions whose captures
 * are values while their bodies remain expressions, and the `entry` helper
 * and the static functions, `Object.is`, functions with neither. Every form
 * uses EDAG's existing vocabulary; computation nodes occur only inside
 * function bodies.
 *
 * Shape checks do not establish closed-graph validity or canonical metadata.
 * `metadata/module.f.mjs` checks evaluated object keys;
 * `closure/module.f.mjs` checks body scopes, bindings and function lengths.
 * These helpers validate supplied FJS data at an explicit EDAG boundary;
 * VM constructors maintain the invariants directly. FJS data is acyclic by
 * construction. Use `validate`
 * to retain input identity; `parse` rebuilds containers, as documented in
 * `../../rtti/todo/identity-aware-parse.md`.
 *
 * @module
 * @import { EdagValue } from './types.ts'
 * @import { Phantom } from '../../types/phantom/types.ts'
 */

import { exp, primitive, staticId } from '../module.f.mjs'
import { array as rttiArray, number, string } from '../../rtti/module.f.mjs'

/**
 * The raw recursive schema, pinned separately from its phantom annotation.
 * Undefined is tagged just as in EDAG, rather than a bare missing position.
 * @type {() => readonly ['or', typeof primitive, readonly ['undefined'],
 *  typeof array, typeof object, typeof func, typeof entryFunction, typeof hasEntryFunction, typeof staticFunction]}
 */
export const _value = () => ['or', primitive, ['undefined'], array, object, func, entryFunction, hasEntryFunction, staticFunction]

/** Shape of an evaluated value, excluding computation outside function bodies. @type {Phantom<typeof _value, EdagValue>} */
export const value = _value

/** Evaluated array elements or captured slots; no spreads or expressions. */
export const values = rttiArray(value)

/** An array whose elements have already been evaluated. */
export const array = /** @type {const} */ (['[]', values])

/** An own property with its key and value already resolved. */
export const property = /** @type {const} */ ([':', string, value])

/** An object whose properties have already been evaluated. */
export const object = /** @type {const} */ (['{}', rttiArray(property)])

/** A closure's length, evaluated captures and unevaluated invocation body. */
export const func = /** @type {const} */ (['=>', number, values, exp])

/**
 * The `entry` helper as a value, the EDAG's `['entry']` established: a
 * function of `length` `2` with no captures and no body to interpret —
 * the executor answers its call itself, with the value or `undefined` —
 * fresh wherever the node is established, as a closure is.
 */
export const entryFunction = /** @type {const} */ (['entry'])

/** The `hasEntry` helper as a value, `['hasEntry']` established: as `entryFunction`, answering the presence. */
export const hasEntryFunction = /** @type {const} */ (['hasEntry'])

/**
 * A static function as a value, the EDAG's own node, `['Object.is']`: the
 * built-in, identified by its name, so, unlike `entry`, one function
 * however often it is read, `Object.is === Object.is`, with no captures
 * and no body of its own — its text is its name's, and its call and its
 * `length` are the executor's to answer, from the body the runtime holds
 * at its path, or natively, `Object.entries` (`./entries/module.f.mjs`).
 */
export const staticFunction = /** @type {const} */ ([staticId])
