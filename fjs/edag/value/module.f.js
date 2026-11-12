/**
 * Shape schemas for evaluated EDAG values: data and functions whose captures
 * are values while their bodies remain expressions, and the `entry` helper
 * and the static functions, `Object.is`, functions with neither. Every form
 * uses EDAG's existing vocabulary; computation nodes occur only inside
 * function bodies.
 *
 * Recursive expansion builds one schema level from an already-bound self
 * thunk. Internal descriptor arrays and branch thunks can be fresh on each
 * expansion; the exported schemas stay stable and accept the same values.
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

import { exp, intrinsicId, primitive, staticId } from '../module.f.js'
import { array as rttiArray, number, string } from '../../rtti/module.f.js'

const entrySchema = /** @type {const} */ (['entry'])
const hasEntrySchema = /** @type {const} */ (['hasEntry'])
const intrinsicSchema = /** @type {const} */ ([intrinsicId])
const staticSchema = /** @type {const} */ ([staticId])

/**
 * One level of value-form containers, using an already-bound recursion anchor.
 * @template {() => readonly ['or', ...readonly import('../../rtti/types.ts').Type[]]} V
 * @param {V} recursiveValue
 */
const schemasFor = recursiveValue => {
    /** @type {Phantom<V, EdagValue>} */
    const value = recursiveValue
    const values = rttiArray(value)
    const array = /** @type {const} */ (['[]', values])
    const property = /** @type {const} */ ([':', string, value])
    const object = /** @type {const} */ (['{}', rttiArray(property)])
    const func = /** @type {const} */ (['=>', number, values, exp])
    return { valueList: values, array, property, object, func }
}

/**
 * The raw recursive schema, pinned separately from its phantom annotation.
 * Undefined is tagged just as in EDAG, rather than a bare missing position.
 * @type {() => readonly ['or', typeof primitive, readonly ['undefined'],
 *  typeof array, typeof object, typeof func, typeof entryFunction, typeof hasEntryFunction, typeof intrinsicFunction, typeof staticFunction]}
 */
export const _value = () => {
    const schemas = schemasFor(_value)
    return ['or', primitive, ['undefined'], schemas.array, schemas.object, schemas.func,
        entrySchema, hasEntrySchema, intrinsicSchema, staticSchema]
}

/** Shape of an evaluated value, excluding computation outside function bodies. @type {Phantom<typeof _value, EdagValue>} */
export const value = _value

const schemas = schemasFor(value)

/** Evaluated array elements or captured slots; no spreads or expressions. @type {import('../../rtti/types.ts').Array<typeof value>} */
export const values = schemas.valueList

/** An array whose elements have already been evaluated. @type {readonly ['[]', typeof values]} */
export const array = schemas.array

/** An own property with its key and value already resolved. @type {readonly [':', typeof string, typeof value]} */
export const property = schemas.property

/** An object whose properties have already been evaluated. @type {readonly ['{}', import('../../rtti/types.ts').Array<typeof property>]} */
export const object = schemas.object

/** A closure's length, evaluated captures and unevaluated invocation body. @type {readonly ['=>', typeof number, typeof values, typeof exp]} */
export const func = schemas.func

/**
 * The `entry` helper as a value, the EDAG's `['entry']` established: a
 * function of `length` `2` with no captures and no body to interpret —
 * the executor answers its call itself, with the value or `undefined` —
 * fresh wherever the node is established, as a closure is.
 */
export const entryFunction = entrySchema

/** The `hasEntry` helper as a value, `['hasEntry']` established: as `entryFunction`, answering the presence. */
export const hasEntryFunction = hasEntrySchema

/**
 * An intrinsic as a value, the EDAG's node, `['slice']`: a function of the
 * helper's `length` with no captures and no body to interpret — the
 * executor answers its call itself, the member call of the name on the
 * receiver with no runtime — fresh wherever the node is established, as
 * `entry` is.
 */
export const intrinsicFunction = intrinsicSchema

/**
 * A static function as a value, the EDAG's own node, `['Object.is']`: the
 * built-in, identified by its name, so, unlike `entry`, one function
 * however often it is read, `Object.is === Object.is`, with no captures
 * and no body of its own — its text is its name's, and its call and its
 * `length` are the executor's to answer, from the body the runtime holds
 * at its path, or natively, `Object.entries` (`./entries/module.f.js`).
 */
export const staticFunction = staticSchema
