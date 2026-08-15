/**
 * Runtime deserialization of unknown values against RTTI schemas.
 *
 * The main entry point is `parse(rtti)`, which takes a schema `Type` and returns
 * a `Parse<T>` function. When called with an unknown value, it returns a `Result`
 * that is either `['ok', newValue]` or `['error', { path, message }]`.
 *
 * Unlike `validate`, which checks an existing value in-place and returns it
 * unchanged on success, `parse` always returns a freshly constructed value that
 * contains only the fields/elements declared by the schema. This makes both
 * structs and tuples effectively closed at runtime, matching the TypeScript
 * type produced by `Ts<T>`:
 *
 * - Tuples: the result has exactly the schema's length; extra elements are dropped.
 * - Structs: the result contains only the schema's keys; extra properties are dropped.
 * - Arrays/records: every element/value is itself parsed, so a fresh container is
 *   always returned even if the inner type is a primitive.
 *
 * This also provides forward compatibility with extended serialization formats:
 * a schema-based parser keeps working when newer versions of the format add
 * extra fields or tuple elements.
 *
 * The error shape, path bookkeeping, primitive checks, and schema
 * recognition (`visit`) are shared with `validate` through
 * `../common/module.f.mjs`; only container construction differs.
 *
 * See `./types.ts` for the `Result`/`Parse` type-level API.
 *
 * @module
 *
 * @import { Info1, Struct, Tag1, Tuple, Type } from '../types.ts'
 * @import { Result as CommonResult } from '../../result/types.ts'
 * @import { StringMap } from '../../object/types.ts'
 * @import { List } from '../../list/types.ts'
 * @import { Container, IsContainer, ValidateE, ValidationError, Visitor } from '../common/types.ts'
 * @import { Unknown } from '../ts/types.ts'
 * @import { Parse } from './types.ts'
 */

import { ok } from '../../result/module.f.mjs'
import { reverse, toArray } from '../../list/module.f.mjs'
import {
    constPrimitiveValidate,
    eachEntry,
    isArray,
    isObject,
    orVisit,
    primitive0Validate,
    verror,
    visit,
} from '../common/module.f.mjs'

const { entries } = Object

/** @typedef {CommonResult<Unknown, ValidationError>} _ItemResult */

/** Rebuilds a parsed container from its `[key, parsedValue]` entries. */
/** @typedef {(entries: ReadonlyArray<readonly [string, Unknown]>) => Unknown} _Rebuild */

/** @type {_Rebuild} */
const arrayRebuild = entries => entries.map(([, v]) => v)

/** @type {_Rebuild} */
const recordRebuild = entries => Object.fromEntries(entries)

/** `eachEntry`'s accumulator seed: entries are consed on in reverse as they parse. */
/** @type {List<readonly [string, Unknown]>} */
const emptyEntries = null

/** `eachEntry`'s accumulate step: an O(1) prepend, unlike rebuilding an array on every entry. */
/** @type {(acc: List<readonly [string, Unknown]>, k: string, v: Unknown) => List<readonly [string, Unknown]>} */
const consEntry = (acc, k, v) =>
    ({ first: [k, v], tail: acc })

/** Restores forward order from `consEntry`'s reverse-order list, in one linear pass. */
/** @type {(list: List<readonly [string, Unknown]>) => ReadonlyArray<readonly [string, Unknown]>} */
const orderedEntries = list =>
    toArray(reverse(list))

/**
 * Builds a parser for `array` or `record` schemas. Mirrors `validate`'s
 * `containerValidate`, but rebuilds a fresh container from each item's parsed
 * result instead of returning the value unchanged. The inner item parser is
 * instantiated lazily (only when the container is non-empty) so recursive
 * schemas don't recurse forever on empty containers.
 */
const containerParse =
    /**
     * @template {Tag1} K
     * @param {IsContainer<Container<K>>} isContainer
     * @param {_Rebuild} rebuild
     * @returns {<I extends Type>(item: I) => Parse<Info1<K, I>>}
     */
    (isContainer, rebuild) =>
    item => value => {
        if (!isContainer(value)) {
            return verror('unexpected value')
        }
        const e = entries(value)
        if (e.length === 0) {
            return /** @type {any} */ (ok(rebuild([])))
        }
        const itemParse = /** @type {any} */ (parse(item))
        const r = eachEntry(e, (_k, v) => itemParse(v), emptyEntries, consEntry)
        return r[0] === 'error' ? r : /** @type {any} */ (ok(rebuild(orderedEntries(r[1]))))
    }

const arrayParse = containerParse(isArray, arrayRebuild)

const recordParse = containerParse(isObject, recordRebuild)

/**
 * Builds a parser for `Tuple` or `Struct` const schemas. Mirrors `validate`'s
 * `constContainerValidate`: it iterates the schema's entries (so extra tuple
 * elements and undeclared struct keys are dropped) and rebuilds the result
 * from each parsed item.
 */
const constContainerParse =
    /**
     * @template {Unknown} C
     * @param {IsContainer<C>} isContainer
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {_Rebuild} rebuild
     * @returns {<T extends Tuple | Struct>(rtti: T) => Parse<T>}
     */
    (isContainer, getItem, rebuild) =>
    rtti => value => {
        if (!isContainer(value)) {
            return verror('unexpected value')
        }
        const r = eachEntry(
            entries(rtti),
            (k, t) => (/** @type {any} */ (parse(t))(getItem(value, k))),
            emptyEntries,
            consEntry,
        )
        return r[0] === 'error' ? r : /** @type {any} */ (ok(rebuild(orderedEntries(r[1]))))
    }

const tupleParse = constContainerParse(
    isArray,
    (value, k) => value[Number(k)],
    arrayRebuild,
)

const structParse = constContainerParse(
    isObject,
    (value, k) => value[k],
    recordRebuild,
)

const orParse =
    /**
     * @template {readonly Type[]} T
     * @param {T} rtti
     * @returns {Parse<() => readonly ['or', ...T]>}
     */
    rtti =>
        /** @type {any} */ (orVisit(/** @type {(t: Type) => ValidateE} */ (/** @type {any} */ (parse)))(rtti))

/**
 * Creates a parser function for the given RTTI schema.
 *
 * The returned function takes an unknown value and returns either
 * `['ok', newValue]` containing a freshly constructed value matching the schema,
 * or `['error', { path, message }]` describing the failure location.
 *
 * @param rtti - A schema `Type`: a `Thunk` for tag-based schemas, or a `Const`
 *   (primitive literal, tuple, or struct) for exact-value schemas.
 * @returns A `Parse<T>` function.
 *
 * @example
 * ```js
 * const p = parse(array(number))
 * p([1, 2, 3])         // ['ok', [1, 2, 3]]   (a new array)
 * p([1, 'two'])        // ['error', { path: ['1'], message: 'unexpected value' }]
 *
 * // tuples are closed: extra elements are dropped
 * parse([number, number])([1, 2, 3]) // ['ok', [1, 2]]
 *
 * // structs drop undeclared keys
 * parse({ a: number })({ a: 1, b: 2 }) // ['ok', { a: 1 }]
 * ```
 */
const parseVisitor = /** @type {any} */ ({
    tuple: tupleParse,
    struct: structParse,
    array: arrayParse,
    record: recordParse,
    or: orParse,
    constPrimitive: constPrimitiveValidate,
    primitive0: primitive0Validate,
    unknown: () => ok,
})

/** @type {<T extends Type>(rtti: T) => Parse<T>} */
export const parse = rtti =>
    (visit(parseVisitor)(rtti))
