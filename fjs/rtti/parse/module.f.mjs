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
 * @import { Container, Fits, IsContainer, Presence, SchemaEntries, ValidateE, ValidationError, Visitor } from '../common/types.ts'
 * @import { Unknown } from '../ts/types.ts'
 * @import { Parse } from './types.ts'
 * @import { _Declared, _Entries, _Rebuild } from './private.ts'
 */

import { ok } from '../../types/result/module.f.mjs'
import {
    absentMember,
    constPrimitiveValidate,
    eachEntry,
    isArray,
    isObject,
    orVisit,
    presenceUnchanged,
    primitive0Validate,
    structSchemaEntries,
    tupleSchemaEntries,
    hasUndeclaredMember,
    undeclaredMembers,
    verror,
    visit,
} from '../common/module.f.mjs'
import { emptyRest } from '../data/module.f.mjs'

/**
 * The rebuilds' one construction step, captured at module load.
 *
 * Reading a member of the value can run **arbitrary code** — an accessor —
 * and the rebuild runs after every read, so by then that code may have
 * replaced anything the language reaches by dynamic lookup: an
 * `Array.prototype` method (`concat`, `map`, `flatMap`), the array
 * iterator every `for..of` and destructuring dispatches,
 * `Object.fromEntries`, the `Array` binding `new Array` resolves, or the
 * `constructor`/`@@species` lookup inside every array method — even a
 * *captured* `concat` builds its result through the receiver's species. A
 * rebuild dispatching any of those was steered into `['ok', …]` values
 * failing the very schema they were parsed against — see
 * `../host.proof.mjs`.
 *
 * `defineProperty` on a fresh container consults none of that: it creates
 * an own data property directly, the array exotic length update included.
 * So the rebuilds walk the entry cons list — plain literals this module
 * built — by property reads alone, place members with this one captured
 * operation, and perform no other dynamic lookup at all (`+k` is the
 * index read, `Number` being a patchable global).
 */
const { defineProperty } = Object

/** The one `Array` the rebuilds construct with, captured at module load. */
const PlainArray = Array

/** The descriptor a literal would create: an enumerable own data property. */
/** @type {(value: Unknown) => PropertyDescriptor} */
const enumerableValue = value =>
    ({ value, writable: true, enumerable: true, configurable: true })

/** Restores member order from the reverse-order entries, in one linear pass. */
/** @type {(entries: _Entries) => _Entries} */
const reverseEntries = entries => {
    /** @type {_Entries} */
    let r = null
    for (let n = entries; n !== null; n = n.tail) {
        r = { first: n.first, tail: r }
    }
    return r
}

/**
 * The uniform **array** kind's rebuild: the parsed elements, dense, in
 * member order — placed back to front, since the entries arrive reversed.
 */
/** @type {_Rebuild} */
const arrayRebuild = entries => {
    let length = 0
    for (let n = entries; n !== null; n = n.tail) { length += 1 }
    const result = new PlainArray(length)
    let i = length
    for (let n = entries; n !== null; n = n.tail) {
        i -= 1
        defineProperty(result, i, enumerableValue(n.first[1]))
    }
    return result
}

/**
 * The **record** and **struct** kinds' rebuild: the parsed members as a fresh
 * plain object, in member order — an absent declared member left no entry,
 * so dropping its key needs nothing more. A key is *defined*, never
 * assigned: assignment dispatches setters up the chain (`'__proto__'`
 * among them), which is the same dynamic surface the rebuilds exist to
 * avoid.
 */
/** @type {_Rebuild} */
const recordRebuild = entries => {
    const result = {}
    for (let n = reverseEntries(entries); n !== null; n = n.tail) {
        defineProperty(result, n.first[0], enumerableValue(n.first[1]))
    }
    return result
}

/**
 * The **tuple** kind's rebuild over its declared members — only the present
 * ones reach `entries`: each at its own index, holes at the absent ones
 * before them, ending at the last present position — so a trailing absent
 * run shortens the result and an interior hole survives (materializing it
 * as `undefined` would denote a different value, and omitting it would
 * shift every position after it). The reversed entries' head *is* the last
 * present position, so the length is known before the walk, and an index
 * never defined stays a hole of `new PlainArray`'s making.
 *
 * The input value is never consulted, and nothing overridable is
 * dispatched — see {@link defineProperty} above for why both matter: an
 * accepted value supplied first a `slice` of its own and then, through an
 * accessor, a patched `Array.prototype.concat`, and each steered a rebuild
 * into a result that fails the schema it was parsed against. An index the
 * value only *inherits* is a present member (HasProperty is what the check
 * dispatched on), so it sits in `entries` and is materialized as an own
 * member of the result, carrying its parsed value — see
 * `../host.proof.mjs`.
 *
 * @type {_Rebuild}
 */
const tupleRebuild = entries => {
    if (entries === null) { return [] }
    const result = new PlainArray(+entries.first[0] + 1)
    /** @type {_Entries} */
    let n = entries
    while (n !== null) {
        defineProperty(result, n.first[0], enumerableValue(n.first[1]))
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

/** What the declared-member fold carries: the present entries, and every member's presence bit. */
/** {@link consDeclared}'s seed. */
/** @type {_Declared} */
const emptyDeclared = { entries: null, presence: null }

/**
 * `eachEntry`'s accumulate step over *declared* members, whose item wraps a
 * present member's parsed value in a one-element list and an absent member
 * in an empty one: the present value is kept, the absent member leaves no
 * entry. The wrapping is what stands in for a sentinel — every value,
 * `undefined` included, is a legal parse result, so no value could mark
 * absence. The presence bit is kept for every member either way — it is
 * what `presenceUnchanged` re-asks after everything that reads the value.
 */
/** @type {(acc: _Declared, k: string, vs: ReadonlyArray<Unknown>) => _Declared} */
const consDeclared = (acc, k, vs) => ({
    entries: vs.length === 0 ? acc.entries : { first: [k, vs[0]], tail: acc.entries },
    presence: { first: vs.length !== 0, tail: acc.presence },
})

/** A uniform container declares no member by name, so every one is undeclared. */
/** @type {readonly string[]} */
const noDeclared = []

/** The declared-member kinds' postcondition check's one lookup, captured at module load. */
const { hasOwn } = Object

/**
 * Whether every declared member the rebuild **omitted** is still absent from
 * `built` — the postcondition the omission was decided on. The accessor a
 * member read can run may install the omitted key on `Object.prototype` (or
 * an omitted position on `Array.prototype`), and then every fresh container
 * *inherits* it: the member is present by the same HasProperty rule the
 * readers dispatch on, so what was built no longer denotes the value that
 * was checked — no plain container can, which is `verror`'s case, not a
 * different construction's (see `../host.proof.mjs`). An omitted member
 * reads `k in built` false; a present one is the rebuild's own; only an
 * inherited declared key is the environment having changed underneath the
 * parse. Both operations are internal — `in` runs no accessor — so the
 * check itself dispatches nothing overridable.
 *
 * @type {(declared: readonly string[], built: ReadonlyArray<Unknown> | StringMap<Unknown>) => boolean}
 */
const omittedStillAbsent = (declared, built) => {
    for (let i = 0; i < declared.length; i += 1) {
        if (declared[i] in built && !hasOwn(built, declared[i])) { return false }
    }
    return true
}

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
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            // The bound, presence, absence, the undeclared check, then
            // the reads. See the comment on the same shape in
            // `../validate/module.f.mjs`, including what settling the shape
            // first assumes of the value.
            // Cheapest structural question first, for the reason
            // `../validate`'s copy states.
            if (!fits(value, declared.length)) {
                return verror('unexpected value')
            }
            const withPresence = rttiEntries.map(([k, t]) =>
                /** @type {readonly[string, readonly[typeof t, boolean]]} */ ([k, [t, k in value]]))
            // Absence before any read, for the reason `../validate`'s
            // copy of this comment gives: reaching an illegal absence
            // through the reading walk restores the exponential.
            const a = eachEntry(
                withPresence,
                (_k, [t, present]) => present ? ok(undefined) : absentMember(t),
                undefined,
                acc => acc,
            )
            if (a[0] === 'error') { return a }
            if (hasUndeclaredMember(declared, value)) {
                return verror('unexpected value')
            }
            const r = eachEntry(
                withPresence,
                (k, [t, present]) => {
                    // Absence is settled above; this walk only records it.
                    if (!present) { return ok([]) }
                    const p = /** @type {any} */ (parse(t))(getItem(value, k))
                    return p[0] === 'error' ? p : ok([p[1]])
                },
                emptyDeclared,
                consDeclared,
            )
            if (r[0] === 'error') { return r }
            // The walk recorded the decisions it was given, so this asks
            // the pre-bound snapshot against the final state.
            if (!presenceUnchanged(rttiEntries, r[1].presence, value)) {
                return verror('unexpected value')
            }
            const built = /** @type {ReadonlyArray<Unknown> | StringMap<Unknown>} */ (rebuild(r[1].entries))
            return omittedStillAbsent(declared, built)
                ? /** @type {any} */ (ok(built))
                : verror('unexpected value')
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
                emptyDeclared,
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
            if (!presenceUnchanged(rttiEntries, d[1].presence, value)) {
                return verror('unexpected value')
            }
            const built = /** @type {ReadonlyArray<Unknown> | StringMap<Unknown>} */ (rebuild(d[1].entries))
            return omittedStillAbsent(declared, built)
                ? ok(built)
                : verror('unexpected value')
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
