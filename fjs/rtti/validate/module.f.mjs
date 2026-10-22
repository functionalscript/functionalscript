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
 * Closedness is the shared rule, not a `parse` detail — see
 * `../guide/schemas/closed-containers/README.md`. A bare `Struct` or `Tuple`
 * admits the members it declares and no others, so an undeclared key or an
 * index past the prefix rejects the value. A tuple answers by **length** as well as by
 * member, because a hole past the prefix is no member and would slip through
 * the member check alone.
 *
 * Closedness is about *undeclared* members and leaves the required/optional
 * rule alone: a member is required exactly when its set excludes **absence**
 * — the `option` bit of its union — so a schema whose trailing position says
 * `or(option, t)` still accepts a shorter array. A tuple schema declares by
 * length, so a hole in the *schema* is a position whose schema is `undefined`
 * — see "A hole is a declared position" in
 * `../guide/schemas/closed-containers/README.md`.
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
 * The reader is `readerOf` in `../common/module.f.mjs`, which `parse` is
 * built from too: schema recognition, the container skeletons and the shape
 * each container kind is read with are written there once, so the two
 * readers read a container in the same order by construction. `validate`
 * supplies a collector that collects nothing, so a validation allocates
 * nothing per entry, and keeps every container as it is. The data
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
 * @import { Type } from '../types.ts'
 * @import { Validate } from '../common/types.ts'
 */

import { noAccumulate, readerOf } from '../common/module.f.mjs'
import { emptyRest } from '../data/module.f.mjs'

/** A checked container is the result: the value it was given, not a reconstruction. */
/** @type {(acc: undefined, value: Unknown) => Unknown} */
const keep = (_, value) => value

/**
 * What `validate` brings to `readerOf` in `../common/module.f.mjs`: nothing
 * to collect — a success carries the value it was given, so a read allocates
 * nothing per member — and every container kind kept as it is.
 */
const read = readerOf(
    { empty: undefined, cons: noAccumulate },
    { array: keep, record: keep, tuple: keep, struct: keep },
    emptyRest,
)

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
    // Through the erased `ValidateE`: `Validate<T>` is what it reads as, and
    // naming it on `readerOf`'s side would instantiate `Ts<Type>` (TS2589).
    /** @type {any} */ (read(rtti))
