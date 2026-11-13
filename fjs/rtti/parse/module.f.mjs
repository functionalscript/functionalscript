/**
 * Runtime deserialization of unknown values against RTTI schemas.
 *
 * The main entry point is `parse(rtti)`, which takes a schema `Type` and returns
 * a `Parse<T>` function. When called with an unknown value, it returns a `Result`
 * that is either `['ok', newValue]` or `['error', { path, message }]`.
 *
 * **Structs and tuples are closed.** A bare `Struct` or `Tuple` admits the
 * members it declares and no others, so a value carrying more is rejected:
 *
 * - Tuples: an array longer than the schema is rejected.
 * - Structs: an undeclared property is rejected.
 * - Arrays/records: every element/value is itself parsed, so a fresh container is
 *   always returned even if the inner type is a primitive.
 *
 * Closedness is about *undeclared* members, and leaves the required/optional
 * rule alone: a member is required exactly when its set excludes **absence**
 * — the `option` bit of its union — so a shorter array whose trailing
 * position says `or(option, t)` is accepted. An absent member is omitted
 * from what is built, never materialized as `undefined`: the struct kind
 * drops the key, and the array kind shortens a trailing absent run. The
 * readers read no array with a hole
 * ([what the readers assume of a value](../guide/readers/assumptions/README.md)),
 * so an absent position is only ever past the end and no rebuilt array has a
 * hole.
 *
 * A tuple schema declares by length, so a hole in the *schema* is a declared
 * position whose schema is `undefined` — see "A hole is a declared position"
 * in `../guide/schemas/closed-containers/README.md`.
 *
 * The length check is the model rather than an inference from the rendering.
 * #1622 added one by reading `Ts<readonly[42]>`'s exact tuple as the value
 * model while the model said open, and was reverted for that reason; what has
 * changed since is the model, not the reading.
 *
 * **A stated rest widens acceptance, not construction.** `rest(c, r)` holds
 * every member `c` does not declare to `r`, and `open(c)` — `rest(c, unknown)`
 * — admits anything else at all; either way the result carries the declared
 * members and nothing else, so a rest says what an undeclared member must be,
 * not that the reader should keep it. Openness is what makes a parser
 * forward-compatible with an extended serialization format, so a schema read
 * against a wire format someone else may extend says `open`. The reader that
 * keeps every member is `../validate/module.f.mjs`.
 *
 * The error shape, path bookkeeping, primitive checks, schema recognition
 * (`visit`) and the container handlers come from `../common/module.f.mjs`.
 * The handlers are one skeleton per container shape, shared with
 * `../validate/module.f.mjs` through `readerOf`, so the two readers read a
 * container in one order; `parse` supplies a collector of the parsed members,
 * and a rebuild per kind.
 *
 * See `./types.ts` for the `Result`/`Parse` type-level API.
 *
 * @module
 *
 * @import { Type } from '../types.ts'
 * @import { Unknown } from '../ts/types.ts'
 * @import { Parse } from './types.ts'
 * @import { _Entries, _Rebuild } from './private.ts'
 */

import { readerOf } from '../common/module.f.mjs'
import { reverse } from '../../types/list/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'

/** The reverse-order entries in member order, in one linear pass. */
/** @type {(entries: _Entries) => ReadonlyArray<readonly [string, Unknown]>} */
const inOrder = entries => toArray(reverse(entries))

/**
 * The **array** kinds' rebuild, uniform and tuple: the parsed elements, dense,
 * in member order. A tuple's absent positions are all past the last present
 * one, since the readers read no array with a hole, so a trailing absent run
 * shortens the result and nothing else is left out.
 *
 * @type {_Rebuild}
 */
const arrayRebuild = entries => inOrder(entries).map(([, v]) => v)

/**
 * The **record** and **struct** kinds' rebuild: the parsed members as a fresh
 * plain object, in member order — an absent declared member left no entry, so
 * dropping its key needs nothing more.
 */
/** @type {_Rebuild} */
const recordRebuild = entries => Object.fromEntries(inOrder(entries))

/**
 * What `parse` brings to `readerOf` in `../common/module.f.mjs`: the parsed
 * members, consed on in reverse as they are read — an O(1) prepend, unlike
 * rebuilding an array on every member — and a rebuild per container kind. A
 * declared member that is absent is collected by nothing, so it leaves no
 * entry and the rebuilds omit it.
 *
 * Every member of a uniform container is parsed, so a fresh container is
 * always returned even if the inner type is a primitive. An absent member of
 * a closed const container is **omitted** from what is built rather than
 * materialized as `undefined`: the struct kind drops the key, and the tuple
 * kind shortens a trailing absent run (see `arrayRebuild`). A container with a stated
 * `rest` builds the declared members and nothing else, since `rest` says what
 * an undeclared member must be and not that the result should carry it.
 */
const read = readerOf(
    {
        /** @type {_Entries} */
        empty: null,
        cons: (acc, k, v) => ({ first: /** @type {const} */ ([k, v]), tail: acc }),
    },
    { array: arrayRebuild, record: recordRebuild, tuple: arrayRebuild, struct: recordRebuild },
)

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
 * // closed: a longer array is rejected
 * parse([number, number])([1, 2, 3]) // ['error', …]
 *
 * // closed: the undeclared key is rejected
 * parse({ a: number })({ a: 1, b: 2 }) // ['error', …]
 *
 * // with a rest: it is accepted, checked, and not carried over
 * parse(rest({ a: number }, string))({ a: 1, b: 'x' }) // ['ok', { a: 1 }]
 *
 * // `open` admits anything else at all, and carries none of it over
 * parse(open({ a: number }))({ a: 1, b: 2 }) // ['ok', { a: 1 }]
 * ```
 *
 * @type {<const T extends Type>(rtti: T) => Parse<T>}
 */
export const parse = rtti =>
    // Through the erased `ValidateE`: `Parse<T>` is what it reads as, and
    // naming it on `readerOf`'s side would instantiate `Ts<Type>` (TS2589).
    /** @type {any} */ (read(rtti))
