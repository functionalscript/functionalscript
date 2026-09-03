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
 * The error shape, path bookkeeping, primitive checks, and schema
 * recognition (`visit`) come from `../common/module.f.mjs`.
 *
 * See `./types.ts` for the `Result`/`Parse` type-level API.
 *
 * @module
 *
 * @import { ConstObject, Info1, Tag1, Type } from '../types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Container, Fits, IsContainer, SchemaEntries, ValidateE, ValidationError, Visitor } from '../common/types.ts'
 * @import { Unknown } from '../ts/types.ts'
 * @import { Parse } from './types.ts'
 * @import { _Entries, _Rebuild } from './private.ts'
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

/** `eachEntry`'s accumulator seed: entries are consed on in reverse as they parse. */
/** @type {_Entries} */
const emptyEntries = null

/** `eachEntry`'s accumulate step: an O(1) prepend, unlike rebuilding an array on every entry. */
/** @type {(acc: _Entries, k: string, v: Unknown) => _Entries} */
const consEntry = (acc, k, v) =>
    ({ first: [k, v], tail: acc })

/**
 * `eachEntry`'s accumulate step over *declared* members, whose item wraps a
 * present member's parsed value in a one-element list and an absent member
 * in an empty one: the present value is kept, the absent member leaves no
 * entry. The wrapping is what stands in for a sentinel — every value,
 * `undefined` included, is a legal parse result, so no value could mark
 * absence.
 */
/** @type {(acc: _Entries, k: string, vs: ReadonlyArray<Unknown>) => _Entries} */
const consDeclared = (acc, k, vs) =>
    vs.length === 0 ? acc : { first: [k, vs[0]], tail: acc }

/** A uniform container declares no member by name, so every one is undeclared. */
/** @type {readonly string[]} */
const noDeclared = []

/**
 * Builds a parser for `array` or `record` schemas: rebuilds a fresh container
 * from each item's parsed result. The inner item parser is instantiated lazily
 * (only when the container is non-empty) so recursive schemas don't recurse
 * forever on empty containers.
 *
 * The members are `undeclaredMembers`', not `Object.entries`', so `array(t)`
 * and `rest([], t)` walk a value the same way — see `containerValidate` in
 * `../validate/module.f.mjs`, which says what an own-entry walk got wrong.
 *
 * `fits` bounds the array kind's length when its element set admits nothing —
 * the same rule on the other reader.
 */
const containerParse =
    /**
     * @template {Tag1} K
     * @param {IsContainer<Container<K>>} isContainer
     * @param {_Rebuild} rebuild
     * @param {(item: Type) => Fits<Container<K>>} restFits
     * @returns {<I extends Type>(item: I) => Parse<Info1<K, I>>}
     */
    (isContainer, rebuild, restFits) =>
    item => {
        // Depends on the schema alone, so it is built once per schema rather
        // than once per parsed value.
        const fits = restFits(item)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const e = undeclaredMembers(noDeclared, value)
            if (e.length === 0) {
                return fits(value, 0)
                    ? /** @type {any} */ (ok(rebuild(null)))
                    : verror('unexpected value')
            }
            const itemParse = /** @type {any} */ (parse(item))
            const r = eachEntry(e, (_k, v) => itemParse(v), emptyEntries, consEntry)
            return r[0] === 'error' ? r : /** @type {any} */ (ok(rebuild(r[1])))
        }
    }

const arrayParse = containerParse(
    isArray,
    arrayRebuild,
    // The cast is the price of one factory over two kinds: `Container<K>` is
    // the union until `K` is bound, and only the array arm has a `length`.
    item => (value, declared) =>
        /** @type {ReadonlyArray<Unknown>} */ (value).length <= declared || !emptyRest([], item),
)

const recordParse = containerParse(isObject, recordRebuild, () => () => true)

/** A container has nothing to collect from an undeclared member — only pass/fail matters. */
const noAccumulate = () => undefined

/**
 * Builds a parser for `Tuple` or `Struct` const schemas — **closed**: the
 * members the schema declares and no others. It reads each declared member
 * into the rebuilt result, then answers for every member of the value the
 * schema does not name.
 *
 * `fits` is the one thing the two kinds do not share. An undeclared member is
 * a member on both, but an array is also *as long as it is*: a hole past the
 * prefix is no member and would slip through the member check alone, so the
 * array kind answers with its length as well.
 *
 * A declared member is **absent** when its key or index is neither an own
 * property nor an inherited one — the same HasProperty test
 * `../validate/module.f.mjs` dispatches on — and absence is decided here,
 * before dispatch, since the recursive reader is handed only the value read.
 * An absent member is legal exactly when its schema admits absence, and is
 * **omitted** from what is built rather than materialized as `undefined`:
 * the struct kind drops the key, and the array kind preserves indices —
 * a trailing absent run shortens the result, an interior one stays a hole
 * (see `tupleRebuild`).
 */
const constContainerParse =
    /**
     * @template {ReadonlyArray<Unknown> | StringMap<Unknown>} C
     * @template {ConstObject} S
     * @param {IsContainer<C>} isContainer
     * @param {SchemaEntries<S>} schemaEntries
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {_Rebuild} rebuild
     * @param {Fits<C>} fits
     * @returns {<T extends S>(rtti: T) => Parse<T>}
     */
    (isContainer, schemaEntries, getItem, rebuild, fits) =>
    rtti => {
        // Depend on `rtti` alone, so they are computed once per schema.
        const rttiEntries = schemaEntries(rtti)
        const declared = rttiEntries.map(([k]) => k)
        // One lookup per key at the gate, rather than a scan of `declared`.
        const isDeclared = declaredTest(declared)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            // The bound, absence, the undeclared check, then the reads.
            // See the comment on the same shape in
            // `../validate/module.f.mjs`, including what settling the shape
            // first assumes of the value.
            // Cheapest structural question first, for the reason
            // `../validate`'s copy states.
            if (!fits(value, declared.length)) {
                return verror('unexpected value')
            }
            // Absence before any read, and carrying nothing forward so it
            // stops at the first illegal one — for the reasons
            // `../validate`'s copy of this comment gives.
            const a = eachEntry(
                rttiEntries,
                (k, t) => k in value ? ok(undefined) : absentMember(t),
                undefined,
                acc => acc,
            )
            if (a[0] === 'error') { return a }
            if (hasUndeclaredMember(isDeclared, value)) {
                return verror('unexpected value')
            }
            const r = eachEntry(
                rttiEntries,
                (k, t) => {
                    // Absence is settled above, so this one is legal.
                    if (!(k in value)) { return ok([]) }
                    const p = /** @type {any} */ (parse(t))(getItem(value, k))
                    return p[0] === 'error' ? p : ok([p[1]])
                },
                emptyEntries,
                consDeclared,
            )
            return r[0] === 'error' ? r : /** @type {any} */ (ok(rebuild(r[1])))
        }
    }

const tupleParse = constContainerParse(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    tupleRebuild,
    (value, declared) => value.length <= declared,
)

const structParse = constContainerParse(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    recordRebuild,
    () => true,
)

/**
 * Builds a parser for a container with a stated `rest`. The declared members
 * are read exactly as the bare form reads them, and every member the schema
 * does not name is held to `rest` — checked on the way in and absent from what
 * is built, since `rest` says what an undeclared member must be and not that
 * the result should carry it.
 *
 * `restFits` carries the array kind's length bound, which a `rest` removes
 * only while it admits something — see `restContainerValidate` in
 * `../validate/module.f.mjs`, the same rule on the other reader.
 */
const restContainerParse =
    /**
     * @template {ReadonlyArray<Unknown> | StringMap<Unknown>} C
     * @template {ConstObject} S
     * @param {IsContainer<C>} isContainer
     * @param {SchemaEntries<S>} schemaEntries
     * @param {(value: C, k: string) => Unknown} getItem
     * @param {_Rebuild} rebuild
     * @param {(rtti: S, r: Type) => Fits<C>} restFits
     * @returns {(rtti: S, r: Type) => ValidateE}
     */
    (isContainer, schemaEntries, getItem, rebuild, restFits) =>
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
                (k, t) => {
                    if (!(k in value)) {
                        const a = absentMember(t)
                        return a[0] === 'error' ? a : ok([])
                    }
                    const p = /** @type {any} */ (parse(t))(getItem(value, k))
                    return p[0] === 'error' ? p : ok([p[1]])
                },
                emptyEntries,
                consDeclared,
            )
            if (d[0] === 'error') { return d }
            const extra = undeclaredMembers(declared, value)
            if (extra.length === 0) {
                if (!fits(value, declared.length)) {
                    return verror('unexpected value')
                }
            } else {
                const restParse = /** @type {any} */ (parse(r))
                const e = eachEntry(extra, (_k, v) => restParse(v), undefined, noAccumulate)
                if (e[0] === 'error') { return e }
            }
            return ok(rebuild(d[1]))
        }
    }

const restTupleParse = restContainerParse(
    isArray,
    tupleSchemaEntries,
    (value, k) => value[Number(k)],
    tupleRebuild,
    (rtti, r) => (value, declared) => value.length <= declared || !emptyRest(rtti, r),
)

const restStructParse = restContainerParse(
    isObject,
    structSchemaEntries,
    (value, k) => value[k],
    recordRebuild,
    () => () => true,
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
