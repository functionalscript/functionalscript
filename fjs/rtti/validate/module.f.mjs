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
 * const schema = open({ a: number, b: or(option, string) })
 * parse(schema)({ a: 1, extra: 'x' })     // ['ok', { a: 1 }]
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
 * rule alone: a member is required exactly when its set excludes **absence**
 * — the `option` bit of its union — so a schema whose trailing position says
 * `or(option, t)` still accepts a shorter array. A tuple schema declares by
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
 * @import { ConstObject, Info1, Tag1, Type } from '../types.ts'
 * @import { Container, Fits, IsContainer, SchemaEntries, Validate, ValidateE, Visitor } from '../common/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 */

import { ok } from '../../types/result/module.f.mjs'
import {
    absentMember,
    constPrimitiveValidate,
    declaredTest,
    eachEntry,
    hasUndeclaredMember,
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
 *
 * A declared member is **absent** when its key or index is neither an own
 * property nor an inherited one — HasProperty, since `getItem` reads through
 * the prototype, so a member the prototype supplies is still held to what
 * the schema says a present value is. Absence is decided here, before
 * dispatch: the recursive reader is handed only the value read, and an
 * absent key reads `undefined`, so it cannot tell `{}` from
 * `{ a: undefined }`. An absent member is legal exactly when its schema
 * admits absence (`admitsAbsence` in `../common/module.f.mjs`); a present
 * one is dispatched as before.
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
        // One lookup per key at the gate, rather than a scan of `declared`.
        const isDeclared = declaredTest(declared)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            // The container's **shape** is settled before any member is
            // read: it is bounded, an illegal absence is rejected, an
            // undeclared member is rejected — and only then are the members
            // read.
            //
            // That order is what makes an `or` of two arities linear
            // instead of 2^depth, which is the shape a schema uses to say a
            // trailing operand may be left out (`fjs/edag`'s chain nodes).
            // The bound settles the arm whose value has too much — an extra
            // index, an undeclared key — and the absence pass settles the
            // arm whose value has too little. Neither alone suffices, and
            // each was measured missing: without the bound, and without
            // deciding absence early, a chain stays exponential in one
            // direction or the other. `parse` does the same, which is what
            // keeps the two readers reporting the same error.
            //
            // Reading `length` and enumerating the keys before the members
            // assumes those reads have no effect — true of every DJS value,
            // and the assumption the readers are written under. What that
            // gives up for a value built by arbitrary JavaScript is stated
            // in "What the readers assume of a value" in `../README.md`.
            // The structural questions run cheapest-first, since any of
            // them settles the container and none of them recurses:
            // `fits` reads one `length`; the absence pass probes and
            // consults the schema once per *declared* member; only the
            // undeclared check enumerates the **value's** keys, which is
            // O(its size) and has no lazy form in JavaScript —
            // `Object.keys` on 500 000 keys is 185ms whether or not the
            // scan stops at the first. So a value one question answers
            // never pays for the ones after it, and the constant-time
            // bound precedes everything else.
            if (!fits(value, declared.length)) {
                return verror('unexpected value')
            }
            // Reaching an illegal absence through the reading walk would
            // first recurse into the members that come before it, and those
            // are the operands the longer arm shares — so the two arms would
            // walk them once each at every level, which is the exponential
            // all over again. Measured on a chain of `['.', exp, index]`
            // with a leaf no arm accepts: 2.5s at depth 16 without this.
            //
            // The pass carries nothing forward, so it stops at the first
            // illegal absence having touched only the members before it: a
            // 500 000-position schema against `[]` answers at index 0. The
            // reading walk asks `in` again rather than being handed a
            // recorded flag — one `HasProperty` on a value whose reads have
            // no effect, which is the assumption stated in `../README.md`,
            // and cheaper than a list the short-circuit would waste.
            const a = eachEntry(
                rttiEntries,
                (k, v) => k in value ? ok(undefined) : absentMember(v),
                undefined,
                acc => acc,
            )
            if (a[0] === 'error') { return a }
            if (hasUndeclaredMember(isDeclared, value)) {
                return verror('unexpected value')
            }
            const r = eachEntry(
                rttiEntries,
                (k, v) => {
                    // Absence is settled above, so this one is legal.
                    if (!(k in value)) { return ok(undefined) }
                    return /** @type {any} */ (validate(v))(getItem(value, k))
                },
                undefined,
                noAccumulate,
            )
            if (r[0] === 'error') { return r }
            // `value` is C (Unknown container), but Ts<T> for T extends Tuple|Struct is not
            // structurally equivalent to C — TypeScript can't narrow element types through the loop.
            return /** @type {any} */ (ok(value))
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
                (k, v) => {
                    if (!(k in value)) {
                        const a = absentMember(v)
                        return a[0] === 'error' ? a : ok(undefined)
                    }
                    return /** @type {any} */ (validate(v))(getItem(value, k))
                },
                undefined,
                noAccumulate,
            )
            if (d[0] === 'error') { return d }
            const extra = undeclaredMembers(declared, value)
            if (extra.length === 0) {
                if (!fits(value, declared.length)) {
                    return verror('unexpected value')
                }
            } else {
                const restValidate = /** @type {any} */ (validate(r))
                const e = eachEntry(extra, (_k, v) => restValidate(v), undefined, noAccumulate)
                if (e[0] === 'error') { return e }
            }
            return ok(value)
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
    // Absence is decided by the container loop before dispatch, so a value
    // that reaches this handler is present — and no present value is absent.
    // An ordinary error is what lets `orVisit` try the other members of
    // `or(option, t)`.
    option: () => () => verror('unexpected value'),
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
 * validate({ a: number, b: or(option, string) })({ a: 1 })  // ['ok', { a: 1 }]
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
