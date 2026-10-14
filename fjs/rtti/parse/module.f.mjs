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
 * - Tuples: an array longer than the schema is rejected — by length as well as
 *   by member, since a hole past the prefix is no member.
 * - Structs: an undeclared property is rejected.
 * - Arrays/records: every element/value is itself parsed, so a fresh container is
 *   always returned even if the inner type is a primitive.
 *
 * Closedness is about *undeclared* members, and leaves the required/optional
 * rule alone: a member is required exactly when its set excludes **absence**
 * — the `option` bit of its union — so a shorter array whose trailing
 * position says `or(option, t)` is accepted. An absent member is omitted
 * from what is built, never materialized as `undefined`: the struct kind
 * drops the key, the array kind keeps a hole a hole and shortens a trailing
 * absent run.
 *
 * A tuple schema declares by length, so a hole in the *schema* is a declared
 * position whose schema is `undefined` — see "A hole is a declared position"
 * in `../README.md`.
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
 * `../validate/module.f.mjs` so the two readers read a container in one order;
 * `parse` supplies a `Reader` that collects the parsed members, and a rebuild
 * per kind.
 *
 * See `./types.ts` for the `Result`/`Parse` type-level API.
 *
 * @module
 *
 * @import { ConstObject, Type } from '../types.ts'
 * @import { Reader, ValidateE } from '../common/types.ts'
 * @import { Unknown } from '../ts/types.ts'
 * @import { Parse } from './types.ts'
 * @import { _Entries, _Rebuild } from './private.ts'
 */

import { ok } from '../../types/result/module.f.js'
import {
    constContainerRead,
    constPrimitiveValidate,
    containerRead,
    isArray,
    isObject,
    orVisit,
    primitive0Validate,
    restContainerRead,
    structSchemaEntries,
    tupleSchemaEntries,
    verror,
    visit,
} from '../common/module.f.mjs'
import { emptyRest } from '../data/module.f.mjs'
import { reverse, toArray } from '../../types/list/module.f.mjs'

/** The reverse-order entries in member order, in one linear pass. */
/** @type {(entries: _Entries) => ReadonlyArray<readonly [string, Unknown]>} */
const inOrder = entries => toArray(reverse(entries))

/** The uniform **array** kind's rebuild: the parsed elements, dense, in member order. */
/** @type {_Rebuild} */
const arrayRebuild = entries => inOrder(entries).map(([, v]) => v)

/**
 * The **record** and **struct** kinds' rebuild: the parsed members as a fresh
 * plain object, in member order — an absent declared member left no entry, so
 * dropping its key needs nothing more.
 */
/** @type {_Rebuild} */
const recordRebuild = entries => Object.fromEntries(inOrder(entries))

/**
 * The **tuple** kind's rebuild over its declared members — only the present
 * ones reach `entries`: each at its own index, holes at the absent ones
 * before them, ending at the last present position — so a trailing absent
 * run shortens the result and an interior hole survives (materializing it
 * as `undefined` would denote a different value, and omitting it would
 * shift every position after it). The reversed entries' head *is* the last
 * present position, so the length is known before the walk.
 *
 * A hole is the one member shape no expression builds: `.map` and spread
 * materialize `undefined` at it. So this kind alone places its members into
 * a fresh array of the right length and leaves every index it never writes a
 * hole — the array is this function's own and is returned before anything
 * else can see it.
 *
 * @type {_Rebuild}
 */
const tupleRebuild = entries => {
    if (entries === null) { return [] }
    const result = new Array(+entries.first[0] + 1)
    /** @type {_Entries} */
    let n = entries
    while (n !== null) {
        Object.defineProperty(result, n.first[0], {
            value: n.first[1], writable: true, enumerable: true, configurable: true,
        })
        n = n.tail
    }
    return result
}

/**
 * What `parse` brings to the container skeletons in `../common/module.f.mjs`:
 * itself, for each member's schema, and the parsed members, consed on in
 * reverse as they are read — an O(1) prepend, unlike rebuilding an array on
 * every member. A declared member that is absent is collected by nothing, so
 * it leaves no entry and the rebuilds omit it.
 *
 * @type {Reader<_Entries>}
 */
const reader = {
    // Through the erased `ValidateE`: `parse(t)` at `Type` would instantiate
    // `Ts<Type>` (TS2589) — the boundary `orVisit` describes.
    read: t => /** @type {any} */ (parse(t)),
    empty: null,
    cons: (acc, k, v) => ({ first: [k, v], tail: acc }),
}

/**
 * The uniform containers: every member is parsed, so a fresh container is
 * always returned even if the inner type is a primitive.
 */
const arrayParse = containerRead(reader)(
    isArray,
    item => (value, declared) => value.length <= declared || !emptyRest([], item),
    arrayRebuild,
)

const recordParse = containerRead(reader)(isObject, () => () => true, recordRebuild)

/**
 * The closed const containers. An absent member is **omitted** from what is
 * built rather than materialized as `undefined`: the struct kind drops the
 * key, and the array kind preserves indices — a trailing absent run shortens
 * the result, an interior one stays a hole (see `tupleRebuild`).
 */
const tupleParse = constContainerRead(reader)(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    (value, declared) => value.length <= declared,
    tupleRebuild,
)

const structParse = constContainerRead(reader)(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    () => true,
    recordRebuild,
)

/**
 * The containers with a stated `rest`: what is built carries the declared
 * members and nothing else, since `rest` says what an undeclared member must
 * be and not that the result should carry it.
 */
const restTupleParse = restContainerRead(reader)(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    (rtti, r) => (value, declared) => value.length <= declared || !emptyRest(rtti, r),
    tupleRebuild,
)

const restStructParse = restContainerRead(reader)(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    () => () => true,
    recordRebuild,
)

/** @type {(rtti: ConstObject, r: Type) => ValidateE} */
const restParse = (rtti, r) =>
    rtti instanceof Array
        ? restTupleParse(rtti, r)
        : restStructParse(rtti, r)

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
 */
const parseVisitor = /** @type {any} */ ({
    tuple: tupleParse,
    struct: structParse,
    rest: restParse,
    array: arrayParse,
    record: recordParse,
    or: orParse,
    constPrimitive: constPrimitiveValidate,
    primitive0: primitive0Validate,
    unknown: () => ok,
    // Absence is decided by the container loop before dispatch, so a value
    // that reaches this handler is present — and no present value is absent.
    // An ordinary error is what lets `orVisit` try the other members of
    // `or(option, t)`.
    option: () => () => verror('unexpected value'),
})

/** @type {<const T extends Type>(rtti: T) => Parse<T>} */
export const parse = rtti =>
    (visit(parseVisitor)(rtti))
