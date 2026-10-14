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
 * handlers are the skeletons `parse` reads through too (`containerRead`,
 * `constContainerRead` and `restContainerRead` in `../common/module.f.mjs`),
 * which state each shape's read order once; `validate` supplies a `Reader`
 * that collects nothing, so a validation allocates nothing per entry. The data
 * form's `validate` (`../data/module.f.mjs`) is the same shape over `Data`.
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
 * @import { ConstObject, Type } from '../types.ts'
 * @import { Reader, Validate, ValidateE } from '../common/types.ts'
 */

import { ok } from '../../types/result/module.f.js'
import {
    constContainerRead,
    constPrimitiveValidate,
    containerRead,
    isArray,
    isObject,
    noAccumulate,
    orVisit,
    primitive0Validate,
    restContainerRead,
    structSchemaEntries,
    tupleSchemaEntries,
    verror,
    visit,
} from '../common/module.f.mjs'
import { emptyRest } from '../data/module.f.mjs'

/**
 * What `validate` brings to the container skeletons in
 * `../common/module.f.mjs`: itself, for each member's schema, and nothing to
 * collect — a success carries the value it was given, so a read allocates
 * nothing per member.
 *
 * @type {Reader<undefined>}
 */
const reader = {
    // Through the erased `ValidateE`: `validate(t)` at `Type` would instantiate
    // `Ts<Type>` (TS2589) — the boundary `orVisit` describes.
    read: t => /** @type {any} */ (validate(t)),
    empty: undefined,
    cons: noAccumulate,
}

/** A checked container is the result: the value it was given, not a reconstruction. */
/** @type {(acc: undefined, value: Unknown) => Unknown} */
const keep = (_, value) => value

const arrayValidate = containerRead(reader)(
    isArray,
    item => (value, declared) => value.length <= declared || !emptyRest([], item),
    keep,
)

const recordValidate = containerRead(reader)(isObject, () => () => true, keep)

const tupleValidate = constContainerRead(reader)(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    (value, declared) => value.length <= declared,
    keep,
)

const structValidate = constContainerRead(reader)(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    () => true,
    keep,
)

const restTupleValidate = restContainerRead(reader)(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    (rtti, r) => (value, declared) => value.length <= declared || !emptyRest(rtti, r),
    keep,
)

const restStructValidate = restContainerRead(reader)(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    () => () => true,
    keep,
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
