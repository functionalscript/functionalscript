/**
 * Runtime validation of unknown values against RTTI schemas — the verbatim
 * reader.
 *
 * The main entry point is `validate(rtti)`, which takes a schema `Type` and
 * returns a `Validate<T>` function. When called with an unknown value, it
 * returns a `Result` that is either `['ok', value]` — **the value it was
 * given** — or `['error', { path, message }]`.
 *
 * ## What distinguishes it from `parse`
 *
 * `../parse/module.f.mjs` answers "read this value as `T`" and builds a fresh
 * value holding exactly what the schema declares. `validate` answers "is this
 * value a `T`?" about the value itself, so on success the caller keeps the
 * object it passed in — same reference, same members, same serialization:
 *
 * ```js
 * const schema = { a: number, b: option(string) }
 * parse(schema)({ a: 1, extra: 'x' })     // ['ok', { a: 1, b: undefined }]
 * validate(schema)({ a: 1, extra: 'x' })  // ['ok', { a: 1, extra: 'x' }]
 * ```
 *
 * The two agree on **acceptance**: every value one accepts the other accepts,
 * with the same error `path` and `message`. They differ only in what a success
 * carries. `./proof.f.mjs` pins that agreement as a table rather than leaving
 * it to convention. Which reader a caller wants, and why both exist, is in
 * "The two schema-form readers" in `../README.md`.
 *
 * ## Structs and tuples are open
 *
 * Openness is the shared rule, not a `parse` detail — see "Structs and tuples
 * are open" in `../README.md`. `validate` iterates the *schema's* entries, so
 * an undeclared key or a longer array is never visited: it is accepted, and it
 * is still there afterwards because the value is returned as-is. An absent
 * member reads as `undefined`, so a member is required exactly when its set
 * excludes `undefined`.
 *
 * **Do not add a length check for tuples here.** `Ts<readonly [42]>` is the
 * exact tuple only because TypeScript cannot express the open one (see
 * `../ts/types.ts` `TupleTs`); reading that rendering as the value model is
 * what produced #1622, whose check lived in this module's ancestor and was
 * deleted with it. A schema that wants exact members says so, with `close` —
 * see "Closed containers" in `../README.md`.
 *
 * ## Closed containers
 *
 * `close(c)` admits only the members `c` declares, and `close(c, rest)` admits
 * those plus any number of members belonging to `rest`. This narrows what is
 * accepted and changes nothing else: a success still carries the very value it
 * was given, undeclared members included.
 *
 * ## Dispatch strategy
 *
 * Schema recognition is delegated to `visit` in `../common/module.f.mjs`,
 * which routes each `Type` variant to a handler in the `Visitor` record
 * defined below; nothing here walks the `Type` ADT itself. The container
 * handlers drive `eachEntry` in its no-accumulator mode — the mode its JSDoc
 * describes for "a caller whose whole question is 'did every entry
 * succeed?'" — so a validation allocates nothing per entry. The data form's
 * `validate` (`../data/module.f.mjs`) is the same shape over `Data`.
 *
 * ## Recursion safety
 *
 * For `array` and `record` schemas, the inner item validator is instantiated
 * lazily — only after confirming the container is non-empty. This prevents
 * infinite recursion when validating recursive schemas like
 * `const list = () => ['array', list]`.
 *
 * See `./types.ts` for the `Path`/`Result`/`Validate`/`ValidationError`
 * type-level API.
 *
 * @module
 *
 * @import { Unknown } from '../ts/types.ts'
 * @import { ConstObject, Info1, Struct, Tag1, Tuple, Type } from '../types.ts'
 * @import { Container, IsContainer, Validate, ValidateE, Visitor } from '../common/types.ts'
 * @import { StringMap } from '../../object/types.ts'
 */

import { ok } from '../../result/module.f.mjs'
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

/** `validate` has nothing to collect from a successful entry — only pass/fail matters. */
const noAccumulate = () => undefined

/**
 * Builds a validator for `array` or `record` schemas.
 * The inner item validator is instantiated lazily (only when the container is
 * non-empty) to avoid infinite recursion with recursive schemas.
 */
const containerValidate =
    /**
     * @template {Tag1} K
     * @param {IsContainer<Container<K>>} isContainer
     * @returns {<I extends Type>(item: I) => Validate<Info1<K, I>>}
     */
    isContainer =>
    item => value => {
        if (!isContainer(value)) {
            return verror('unexpected value')
        }
        const e = entries(value)
        if (e.length === 0) {
            return /** @type {any} */ (ok(value))
        }
        // Note: we shouldn't instantiate `itemValidate` until we make sure `entries` is not empty.
        //       Otherwise, we can get infinite recursion on empty arrays and objects
        const itemValidate = validate(item)
        const r = eachEntry(e, (_k, v) => itemValidate(v), undefined, noAccumulate)
        // `value` is Container<K>, but Ts<Info1<K,I>> = readonly Ts<I>[] | Record<string,Ts<I>>.
        // TypeScript can't narrow the container's element types through the validation loop.
        return r[0] === 'error' ? r : /** @type {any} */ (ok(value))
    }

const arrayValidate = containerValidate(isArray)

const recordValidate = containerValidate(isObject)

/**
 * Builds a validator for `Tuple` or `Struct` const schemas. It iterates the
 * *schema's* entries, which is what makes both kinds open: a longer array or
 * an undeclared key is never visited, so it is accepted — and, the value being
 * returned as it came, it survives.
 */
const constContainerValidate =
    /**
     * @template {Unknown} C
     * @param {IsContainer<C>} isContainer
     * @param {(value: C, k: string) => Unknown} getItem
     * @returns {<T extends Tuple | Struct>(rtti: T) => Validate<T>}
     */
    (isContainer, getItem) =>
    rtti => {
        // Depends on `rtti` alone, so it is computed once per schema rather
        // than once per validated value.
        const rttiEntries = entries(rtti)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const r = eachEntry(
                rttiEntries,
                (k, v) => /** @type {any} */ (validate(v))(getItem(value, k)),
                undefined,
                noAccumulate,
            )
            // `value` is C (Unknown container), but Ts<T> for T extends Tuple|Struct is not
            // structurally equivalent to C — TypeScript can't narrow element types through the loop.
            return r[0] === 'error' ? r : /** @type {any} */ (ok(value))
        }
    }

const tupleValidate = constContainerValidate(
    isArray,
    (value, k) => value[Number(k)],
)

const structValidate = constContainerValidate(
    isObject,
    (value, k) => value[k],
)

/**
 * Builds a validator for a **closed** `Tuple` or `Struct`. The declared
 * members are checked exactly as the open form checks them, and every member
 * the schema does not name is held to `rest` — or rejected outright when there
 * is none.
 *
 * `fits` is the one thing the two kinds do not share. An undeclared member is
 * an entry on both, but an array is also *as long as it is*: a hole past the
 * prefix is no entry and would slip through the entry check alone, so the
 * array kind answers with its length as well.
 */
const closeContainerValidate =
    /**
     * @template {ReadonlyArray<Unknown> | StringMap<Unknown>} C
     * @param {IsContainer<C>} isContainer
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {(value: C, declared: number) => boolean} fits
     * @returns {(rtti: ConstObject, rest: Type | undefined) => ValidateE}
     */
    (isContainer, getItem, fits) =>
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
                (k, v) => /** @type {any} */ (validate(v))(getItem(value, k)),
                undefined,
                noAccumulate,
            )
            if (r[0] === 'error') { return r }
            const extra = undeclaredEntries(declared, value)
            if (rest === undefined) {
                return extra.length === 0 && fits(value, declared.length)
                    ? ok(value)
                    : verror('unexpected value')
            }
            const restValidate = /** @type {any} */ (validate(rest))
            const e = eachEntry(extra, (_k, v) => restValidate(v), undefined, noAccumulate)
            return e[0] === 'error' ? e : ok(value)
        }
    }

const closeTupleValidate = closeContainerValidate(
    isArray,
    (value, k) => value[Number(k)],
    (value, declared) => value.length <= declared,
)

const closeStructValidate = closeContainerValidate(
    isObject,
    (value, k) => value[k],
    () => true,
)

/** @type {(rtti: ConstObject, rest: Type | undefined) => ValidateE} */
const closeValidate = (rtti, rest) =>
    (rtti instanceof Array ? closeTupleValidate : closeStructValidate)(rtti, rest)

const orValidate =
    /**
     * @template {readonly Type[]} T
     * @param {T} rtti
     * @returns {Validate<() => readonly ['or', ...T]>}
     */
    rtti =>
        /** @type {any} */ (orVisit(/** @type {any} */ (validate))(rtti))

const validateVisitor = /** @type {any} */ ({
    tuple: tupleValidate,
    struct: structValidate,
    close: closeValidate,
    array: arrayValidate,
    record: recordValidate,
    or: orValidate,
    constPrimitive: constPrimitiveValidate,
    primitive0: primitive0Validate,
    unknown: () => ok,
})

/**
 * Creates a validator function for the given RTTI schema: a `Thunk` for
 * tag-based schemas, or a `Const` (primitive literal, tuple, or struct) for
 * exact-value schemas.
 *
 * The returned function takes an unknown value and returns either
 * `['ok', value]` — the very value it was given, not a reconstruction — or
 * `['error', { path, message }]` describing the failure location.
 *
 * Use it when the question is "is this value of this shape?" and the value has
 * to survive the question intact. Use `../parse/module.f.mjs` when the answer
 * wanted is a value built to the schema.
 *
 * @example
 * ```js
 * const v = validate(array(number))
 * const input = [1, 2, 3]
 * v(input)      // ['ok', input] — the same array, not a copy
 * v([1, 'two']) // ['error', { path: ['1'], message: 'unexpected value' }]
 *
 * // open, and the extras are still there afterwards
 * validate([number, number])([1, 2, 3])    // ['ok', [1, 2, 3]]
 * validate({ a: number })({ a: 1, b: 2 })  // ['ok', { a: 1, b: 2 }]
 *
 * // an absent optional member stays absent
 * validate({ a: number, b: option(string) })({ a: 1 })  // ['ok', { a: 1 }]
 *
 * // closed, so the extras are what the schema says they may be — or nothing
 * validate(close({ a: number }))({ a: 1, b: 2 })          // ['error', …]
 * validate(close({ a: number }, number))({ a: 1, b: 2 })  // ['ok', { a: 1, b: 2 }]
 * ```
 *
 * @type {<const T extends Type>(rtti: T) => Validate<T>}
 */
export const validate = rtti =>
    (visit(validateVisitor)(rtti))
