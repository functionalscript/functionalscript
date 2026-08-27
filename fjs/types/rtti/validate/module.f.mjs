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
 * ## Structs and tuples are closed
 *
 * Closedness is the shared rule, not a `parse` detail — see "Structs and
 * tuples are closed" in `../README.md`. A bare `Struct` or `Tuple` admits the
 * members it declares and no others, so an undeclared key or an index past the
 * prefix rejects the value. A tuple answers by **length** as well as by
 * member, because a hole past the prefix is no member and would slip through
 * the member check alone.
 *
 * Closedness is about *undeclared* members and leaves the required/optional
 * rule alone: an absent member reads as `undefined`, so a member is required
 * exactly when its set excludes `undefined`, and a schema whose trailing
 * position admits it still accepts a shorter array. A tuple schema declares by
 * length, so a hole in the *schema* is a position whose schema is `undefined`
 * — see "A hole is a declared position" in `../README.md`.
 *
 * The length check is the model rather than an inference from `Ts<>`. #1622
 * added one by reading `Ts<readonly[42]>`'s exact tuple as the value model
 * while the model said open, and it was reverted for that reason; what has
 * changed since is the model, not the reading.
 *
 * ## Stated rests
 *
 * `rest(c, r)` admits the declared members plus any number of members
 * belonging to `r`, and `open(c)` — `rest(c, unknown)` — admits anything else
 * besides. This widens what is accepted and changes nothing else: a success
 * still carries the very value it was given, undeclared members included.
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
 * The inner validator of an `array`, a `record` or a `rest` is instantiated
 * lazily — only after confirming there is a member for it to read. This
 * prevents infinite recursion when validating recursive schemas like
 * `const list = () => ['array', list]`.
 *
 * See `./types.ts` for the `Path`/`Result`/`Validate`/`ValidationError`
 * type-level API.
 *
 * @module
 *
 * @import { Unknown } from '../ts/types.ts'
 * @import { ConstObject, Info1, Tag1, Type } from '../../../rtti/types.ts'
 * @import { Container, Fits, IsContainer, SchemaEntries, Validate, ValidateE, Visitor } from '../common/types.ts'
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
    structSchemaEntries,
    tupleSchemaEntries,
    undeclaredMembers,
    verror,
    visit,
} from '../common/module.f.mjs'
import { emptyRest } from '../data/module.f.mjs'

/** `validate` has nothing to collect from a successful entry — only pass/fail matters. */
const noAccumulate = () => undefined

/** A uniform container declares no member by name, so every one is undeclared. */
/** @type {readonly string[]} */
const noDeclared = []

/**
 * Builds a validator for `array` or `record` schemas.
 * The inner item validator is instantiated lazily (only when the container is
 * non-empty) to avoid infinite recursion with recursive schemas.
 *
 * The members are `undeclaredMembers`', not `Object.entries`': `array(t)` is
 * `rest([], t)`, so the two have to walk a value the same way — an own-entry
 * walk here skipped an index the prototype supplies while the data form's
 * reader found it, which broke the acceptance agreement the three readers are
 * pinned on.
 *
 * `fits` bounds the array kind's length when its element set admits nothing,
 * which is what the data form says by normalizing such a `rest` away: an
 * `array(or())` is the *empty* array and not "any number of holes". It is
 * consulted only where it can change the answer — no member present, and the
 * value reaching further than that — so an ordinary array never asks.
 */
const containerValidate =
    /**
     * @template {Tag1} K
     * @param {IsContainer<Container<K>>} isContainer
     * @param {(item: Type) => Fits<Container<K>>} restFits
     * @returns {<I extends Type>(item: I) => Validate<Info1<K, I>>}
     */
    (isContainer, restFits) =>
    item => {
        // Depends on the schema alone, so it is built once per schema rather
        // than once per validated value.
        const fits = restFits(item)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const e = undeclaredMembers(noDeclared, value)
            if (e.length === 0) {
                return fits(value, 0)
                    ? /** @type {any} */ (ok(value))
                    : verror('unexpected value')
            }
            // Note: we shouldn't instantiate `itemValidate` until we make sure `entries` is not empty.
            //       Otherwise, we can get infinite recursion on empty arrays and objects
            const itemValidate = validate(item)
            const r = eachEntry(e, (_k, v) => itemValidate(v), undefined, noAccumulate)
            // `value` is Container<K>, but Ts<Info1<K,I>> = readonly Ts<I>[] | Record<string,Ts<I>>.
            // TypeScript can't narrow the container's element types through the validation loop.
            return r[0] === 'error' ? r : /** @type {any} */ (ok(value))
        }
    }

const arrayValidate = containerValidate(
    isArray,
    // The cast is the price of one factory over two kinds: `Container<K>` is
    // the union until `K` is bound, and only the array arm has a `length`.
    item => (value, declared) =>
        /** @type {ReadonlyArray<Unknown>} */ (value).length <= declared || !emptyRest([], item),
)

const recordValidate = containerValidate(isObject, () => () => true)

/**
 * Builds a validator for `Tuple` or `Struct` const schemas — **closed**: the
 * members the schema declares and no others. It reads each declared member,
 * then answers for every member of the value the schema does not name.
 *
 * `fits` is the one thing the two kinds do not share. An undeclared member is
 * a member on both, but an array is also *as long as it is*: a hole past the
 * prefix is no member and would slip through the member check alone, so the
 * array kind answers with its length as well.
 */
const constContainerValidate =
    /**
     * @template {ReadonlyArray<Unknown> | StringMap<Unknown>} C
     * @template {ConstObject} S
     * @param {IsContainer<C>} isContainer
     * @param {SchemaEntries<S>} schemaEntries
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {Fits<C>} fits
     * @returns {<T extends S>(rtti: T) => Validate<T>}
     */
    (isContainer, schemaEntries, getItem, fits) =>
    rtti => {
        // Depend on `rtti` alone, so they are computed once per schema rather
        // than once per validated value.
        const rttiEntries = schemaEntries(rtti)
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
            // `value` is C (Unknown container), but Ts<T> for T extends Tuple|Struct is not
            // structurally equivalent to C — TypeScript can't narrow element types through the loop.
            return undeclaredMembers(declared, value).length === 0 && fits(value, declared.length)
                ? /** @type {any} */ (ok(value))
                : verror('unexpected value')
        }
    }

const tupleValidate = constContainerValidate(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    (value, declared) => value.length <= declared,
)

const structValidate = constContainerValidate(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    () => true,
)

/**
 * Builds a validator for a container with a stated `rest`. The declared
 * members are read exactly as the bare form reads them, and every member the
 * schema does not name is held to `rest`.
 *
 * `restFits` carries the array kind's length bound, which a `rest` removes
 * only while it admits something. An empty one says what the bare form says,
 * so `rest(c, or())` and `c` stay one set — the criterion for "empty" is
 * `emptyRest`'s, and it is consulted only when nothing is present past the
 * prefix, since a member that got there and passed is itself the proof that
 * the rest admits something.
 */
const restContainerValidate =
    /**
     * @template {ReadonlyArray<Unknown> | StringMap<Unknown>} C
     * @template {ConstObject} S
     * @param {IsContainer<C>} isContainer
     * @param {SchemaEntries<S>} schemaEntries
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {(rtti: S, r: Type) => Fits<C>} restFits
     * @returns {(rtti: S, r: Type) => ValidateE}
     */
    (isContainer, schemaEntries, getItem, restFits) =>
    (rtti, r) => {
        // Depend on the schema alone, so they are computed once per schema.
        const rttiEntries = schemaEntries(rtti)
        const declared = rttiEntries.map(([k]) => k)
        const fits = restFits(rtti, r)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const d = eachEntry(
                rttiEntries,
                (k, v) => /** @type {any} */ (validate(v))(getItem(value, k)),
                undefined,
                noAccumulate,
            )
            if (d[0] === 'error') { return d }
            const extra = undeclaredMembers(declared, value)
            if (extra.length === 0) {
                return fits(value, declared.length) ? ok(value) : verror('unexpected value')
            }
            const restValidate = /** @type {any} */ (validate(r))
            const e = eachEntry(extra, (_k, v) => restValidate(v), undefined, noAccumulate)
            return e[0] === 'error' ? e : ok(value)
        }
    }

const restTupleValidate = restContainerValidate(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    (rtti, r) => (value, declared) => value.length <= declared || !emptyRest(rtti, r),
)

const restStructValidate = restContainerValidate(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    () => () => true,
)

/** @type {(rtti: ConstObject, r: Type) => ValidateE} */
const restValidate = (rtti, r) =>
    rtti instanceof Array
        ? restTupleValidate(rtti, r)
        : restStructValidate(rtti, r)

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
    rest: restValidate,
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
 * // closed, so a member the schema does not name rejects the value
 * validate([number, number])([1, 2, 3])    // ['error', …]
 * validate({ a: number })({ a: 1, b: 2 })  // ['error', …]
 *
 * // an absent optional member stays absent
 * validate({ a: number, b: option(string) })({ a: 1 })  // ['ok', { a: 1 }]
 *
 * // a stated rest says what the undeclared members may be; `open` says anything
 * validate(rest({ a: number }, number))({ a: 1, b: 2 })  // ['ok', { a: 1, b: 2 }]
 * validate(open({ a: number }))({ a: 1, b: 'x' })        // ['ok', { a: 1, b: 'x' }]
 * ```
 *
 * @type {<const T extends Type>(rtti: T) => Validate<T>}
 */
export const validate = rtti =>
    (visit(validateVisitor)(rtti))
