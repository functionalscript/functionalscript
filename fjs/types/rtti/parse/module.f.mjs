/**
 * Runtime deserialization of unknown values against RTTI schemas.
 *
 * The main entry point is `parse(rtti)`, which takes a schema `Type` and returns
 * a `Parse<T>` function. When called with an unknown value, it returns a `Result`
 * that is either `['ok', newValue]` or `['error', { path, message }]`.
 *
 * **Structs and tuples are open.** A value carrying more than the schema
 * declares is accepted; `parse` then returns a freshly constructed value that
 * contains only the declared fields/elements, so the extras are accepted on
 * the way in and absent on the way out:
 *
 * - Tuples: a longer array is accepted; the result has the schema's length.
 * - Structs: undeclared properties are accepted; the result has only the
 *   schema's keys.
 * - Arrays/records: every element/value is itself parsed, so a fresh container is
 *   always returned even if the inner type is a primitive.
 *
 * A member is required exactly when its set excludes `undefined` — an absent
 * member reads as `undefined`, on both kinds — so a shorter array whose
 * trailing position admits `undefined` is accepted and the gap is filled.
 *
 * Openness is what makes this forward-compatible with extended serialization
 * formats: a schema-based parser keeps working when newer versions of the
 * format add extra fields or tuple elements.
 *
 * **Do not read "the result has the schema's length" as "tuples are closed"
 * and add a length check here.** The set a tuple schema describes includes
 * longer arrays; `Ts<T>` renders the closed approximation only because
 * TypeScript cannot express the open one (see `../ts/types.ts` `TupleTs`), and
 * taking that rendering for the model is what produced #1622. A schema that
 * wants exact members says so, with `close` — see "Closed containers" in
 * `../README.md`.
 *
 * **A closed container narrows acceptance, not construction.** `close(c)`
 * rejects a member `c` does not declare, and `close(c, rest)` holds each such
 * member to `rest`; either way the result carries the declared members and
 * nothing else, exactly as the open form's does. The reader that keeps every
 * member is `../validate/module.f.mjs`.
 *
 * The error shape, path bookkeeping, primitive checks, and schema
 * recognition (`visit`) come from `../common/module.f.mjs`.
 *
 * See `./types.ts` for the `Result`/`Parse` type-level API.
 *
 * @module
 *
 * @import { ConstObject, Info1, Struct, Tag1, Tuple, Type } from '../types.ts'
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
    undeclaredEntries,
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
 * Builds a parser for `array` or `record` schemas: rebuilds a fresh container
 * from each item's parsed result. The inner item parser is instantiated lazily
 * (only when the container is non-empty) so recursive schemas don't recurse
 * forever on empty containers.
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
 * Builds a parser for `Tuple` or `Struct` const schemas. It iterates the
 * *schema's* entries, which is what makes both kinds open: a longer array or
 * an undeclared key is never visited, so it is accepted and left out of the
 * rebuilt result.
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

/** A closed container has nothing to collect from an undeclared member — only pass/fail matters. */
const noAccumulate = () => undefined

/**
 * Builds a parser for a **closed** `Tuple` or `Struct`. The declared members
 * are read exactly as the open form reads them, and every member the schema
 * does not name is held to `rest` — or rejected outright when there is none.
 *
 * `fits` is the one thing the two kinds do not share. An undeclared member is
 * an entry on both, but an array is also *as long as it is*: a hole past the
 * prefix is no entry and would slip through the entry check alone, so the
 * array kind answers with its length as well.
 */
const closeContainerParse =
    /**
     * @template {ReadonlyArray<Unknown> | StringMap<Unknown>} C
     * @param {IsContainer<C>} isContainer
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {_Rebuild} rebuild
     * @param {(value: C, declared: number) => boolean} fits
     * @returns {(rtti: ConstObject, rest: Type | undefined) => ValidateE}
     */
    (isContainer, getItem, rebuild, fits) =>
    (rtti, rest) => {
        // Depend on the schema alone, so they are computed once per schema.
        const rttiEntries = entries(rtti)
        const declared = rttiEntries.map(([k]) => k)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const r = eachEntry(
                rttiEntries,
                (k, t) => (/** @type {any} */ (parse(t))(getItem(value, k))),
                emptyEntries,
                consEntry,
            )
            if (r[0] === 'error') { return r }
            const extra = undeclaredEntries(declared, value)
            if (rest === undefined) {
                return extra.length === 0 && fits(value, declared.length)
                    ? ok(rebuild(orderedEntries(r[1])))
                    : verror('unexpected value')
            }
            const restParse = /** @type {any} */ (parse(rest))
            const e = eachEntry(extra, (_k, v) => restParse(v), undefined, noAccumulate)
            return e[0] === 'error' ? e : ok(rebuild(orderedEntries(r[1])))
        }
    }

const closeTupleParse = closeContainerParse(
    isArray,
    (value, k) => value[Number(k)],
    arrayRebuild,
    (value, declared) => value.length <= declared,
)

const closeStructParse = closeContainerParse(
    isObject,
    (value, k) => value[k],
    recordRebuild,
    () => true,
)

/** @type {(rtti: ConstObject, rest: Type | undefined) => ValidateE} */
const closeParse = (rtti, rest) =>
    (rtti instanceof Array ? closeTupleParse : closeStructParse)(rtti, rest)

const orParse =
    /**
     * @template {readonly Type[]} T
     * @param {T} rtti
     * @returns {Parse<() => readonly ['or', ...T]>}
     */
    rtti =>
        /** @type {any} */ (orVisit(/** @type {any} */ (parse))(rtti))

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
 * // open: a longer array is accepted, and the extra is not carried over
 * parse([number, number])([1, 2, 3]) // ['ok', [1, 2]]
 *
 * // open: an undeclared key is accepted, and not carried over
 * parse({ a: number })({ a: 1, b: 2 }) // ['ok', { a: 1 }]
 *
 * // closed: the undeclared key is rejected
 * parse(close({ a: number }))({ a: 1, b: 2 }) // ['error', …]
 *
 * // closed with a rest: it is accepted, checked, and still not carried over
 * parse(close({ a: number }, string))({ a: 1, b: 'x' }) // ['ok', { a: 1 }]
 * ```
 */
const parseVisitor = /** @type {any} */ ({
    tuple: tupleParse,
    struct: structParse,
    close: closeParse,
    array: arrayParse,
    record: recordParse,
    or: orParse,
    constPrimitive: constPrimitiveValidate,
    primitive0: primitive0Validate,
    unknown: () => ok,
})

/** @type {<const T extends Type>(rtti: T) => Parse<T>} */
export const parse = rtti =>
    (visit(parseVisitor)(rtti))
