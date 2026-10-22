/**
 * Shared kernel for RTTI consumers.
 *
 * `validate` (`../validate/module.f.mjs`) and `parse`
 * (`../parse/module.f.mjs`) are the schema-form consumers, reading a value
 * against a thunk graph; the data form (`../data/module.f.mjs`) is the other,
 * walking a `Data` instead. They produce the same `Result<T, ValidationError>`
 * outcome and differ in how they dispatch, so this module hosts the parts that
 * do not differ:
 *
 * - The error shape (`ValidationError`, `Path`) and path bookkeeping
 *   (`verror`, `prependPath`).
 * - Primitive checks (`primitive0Validate`, `constPrimitiveValidate`).
 * - The `Validate<T>`/`Result<T>` signatures, which `parse` reuses
 *   (`Parse<T> = Validate<T>`).
 * - `visit`: a visitor over the `Type` ADT. Callers supply a `Visitor<R>`
 *   with one handler per variant; `visit(v)(rtti)` recognizes `rtti` and
 *   calls the matching handler. Both schema-form readers compose their
 *   top-level function from a visitor.
 * - `eachEntry`: the container entry loop (array/record/tuple/struct). Callers
 *   choose what (if anything) to accumulate, so a caller that only needs
 *   pass/fail passes `noAccumulate` and pays no allocation per entry.
 * - `tupleSchemaEntries`/`structSchemaEntries`: what a container schema
 *   declares, per kind — the entry list its readers walk.
 * - `undeclaredMembers`: the other half of the loop — the members a container
 *   schema does not name, which a bare schema rejects and a `rest` one holds
 *   to its rest. The data form walks it too, so the two readers state one
 *   rule.
 * - `containerRead`, `constContainerRead`, `restContainerRead`: the
 *   schema-form readers' container handlers, one skeleton per shape. Each
 *   states its shape's read order once, and a `Reader` supplies what differs
 *   between `validate` and `parse`.
 * - `orVisit`: the shared `or` handler — try each variant's recursive walker,
 *   return the first match.
 * - `readerOf`: a whole schema-form reader from what it collects and what it
 *   builds of each container kind. Both schema-form readers are one call of
 *   it, so the container shapes they read are written once.
 *
 * Keeping the kernel here gives schema-driven consumers a stable shared base
 * that does not depend on any one of them.
 *
 * @module
 *
 * @import { Primitive, Unknown } from '../ts/types.ts'
 * @import { ConstObject, Const, Info0, Primitive0, Struct, Tuple, Type } from '../types.ts'
 * @import { Error, Result as CommonResult } from '../../types/result/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Finish, Finishes, Fits, Validate, Visitor, IsContainer, Reader, ResultE, SchemaEntries, ValidateE, ValidationError } from './types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { isArray as commonIsArray } from '../../types/array/module.f.mjs'
import { isObject as commonIsObject } from '../../types/object/module.f.mjs'
import { arrayIndex } from '../../js/array_index/module.f.js'

/** Builds an error result with empty path and the given message. */
/** @type {(message: string) => Error<ValidationError>} */
export const verror = message =>
    error({ path: [], message })

/** Prepends `key` to the error's path, used to build the path bottom-up. */
/** @type {(key: string, error: Error<ValidationError>) => Error<ValidationError>} */
export const prependPath = (key, [,r]) =>
    error({ path: [key, ...r.path], message: r.message })

/** Validates a `Tag0` primitive schema using `typeof`. */
export const primitive0Validate =
    /**
     * @template {Primitive0} K
     * @template {Info0<K>} T
     * @param {K} tag
     * @returns {Validate<T>}
     */
    tag =>
        value => typeof value === tag ? /** @type {any} */ (ok(value)) : verror('unexpected value')

/**
 * Validates a primitive `Const` schema using `Object.is` (SameValue).
 *
 * `Object.is` is used instead of `===` so that:
 * - `NaN` const schemas match `NaN` values (`===` would always fail because `NaN !== NaN`).
 * - `+0` and `-0` are treated as distinct const values.
 */
export const constPrimitiveValidate =
    /**
     * @template {Primitive} T
     * @param {T} rtti
     * @returns {Validate<T>}
     */
    rtti =>
        value => Object.is(rtti, value)
            ? /** @type {any} */ (ok(value))
            : verror('unexpected value')

/** @type {<R>(v: Visitor<R>) => (c: Const) => R} */
const visitConst = v => c =>
    typeof c === 'object' && c !== null
        ? (commonIsArray(c) ? v.tuple(c) : v.struct(c))
        : v.constPrimitive(c)

/** `IsContainer` guard for arrays. */
/** @type {IsContainer<ReadonlyArray<Unknown>>} */
export const isArray =
    value => commonIsArray(value)

/** `IsContainer` guard for records/structs. */
/** @type {IsContainer<StringMap<Unknown>>} */
export const isObject =
    value => commonIsObject(value)

/**
 * Runs `item` over each `[key, value]` entry, bailing out with the first
 * error, path-prefixed with that entry's key. On success, folds each item's
 * result into `acc` (starting from `init`) with `accumulate` and returns the
 * final accumulator.
 *
 * Used by `parse`'s container builders (array/record/tuple/struct), which
 * need the rebuilt `[key, value]` pairs, so they fold them onto a cons list
 * (see the call site) their rebuilds walk directly. A caller whose whole
 * question is "did every entry succeed?" passes `undefined`/`acc => acc`
 * instead and pays no allocation per entry.
 *
 * The walk is by index rather than `for..of` so it can `return` out of the
 * fold at the first error without building the rest.
 */
export const eachEntry =
    /**
     * @template V
     * @template R
     * @template A
     * @param {ReadonlyArray<readonly [string, V]>} entries
     * @param {(k: string, v: V) => CommonResult<R, ValidationError>} item
     * @param {A} init
     * @param {(acc: A, k: string, value: R) => A} accumulate
     * @returns {CommonResult<A, ValidationError>}
     */
    (entries, item, init, accumulate) => {
        let acc = init
        for (let i = 0; i < entries.length; i += 1) {
            const e = entries[i]
            const r = item(e[0], e[1])
            if (r[0] === 'error') {
                return prependPath(e[0], r)
            }
            acc = accumulate(acc, e[0], r[1])
        }
        return ok(acc)
    }

/**
 * What a `Tuple` schema declares, read by **length**.
 *
 * `Array.from` yields `undefined` for a hole and preserves the schema's
 * length, so a hole is a declared position whose schema is `undefined` — which
 * is a `Const` schema in its own right, and exactly what reading index `0` of
 * `new Array(1)` gives. That is the reading `../data/module.f.mjs`'s
 * `containerUnion` has always had, so the canonical data form stays fixed.
 *
 * `Array.from` walks the iterator, which is the *same* walk `containerUnion`
 * makes, and that is the point rather than an accident: the two agree by
 * construction. It holds even for a schema carrying an overridden
 * `Symbol.iterator`, where reading indices here would disagree with the data
 * form all over again — verified: such a schema is read as `number` by the
 * entry reading and as `string` by `containerUnion`. Reading *both* by index
 * is defensible, but it changes the canonical, content-addressed data form and
 * belongs with that decision, not here. FunctionalScript cannot build such a
 * schema in the first place: it has no symbols and no mutation, so the case is
 * reachable only from plain JavaScript, which is also why no proof can pin it.
 *
 * `Object.entries` skips holes, which is why it is not used here: it would
 * make `new Array(1)` and `[]` the same schema while `[undefined]` stayed
 * different from both. It also yields a non-index own property, which is no
 * position either — `getItem` reads a tuple by index, so such a key was
 * declared and then matched against `value[NaN]`. `Array.from` answers
 * positions only. On a plain dense array the two agree exactly.
 *
 * @type {SchemaEntries<Tuple>}
 */
export const tupleSchemaEntries = rtti =>
    Array.from(rtti, (t, i) => [String(i), t])

/**
 * What a `Struct` schema declares: its enumerable own keys. A struct has no
 * holes, so there is nothing for this to disagree with.
 *
 * @type {SchemaEntries<Struct>}
 */
export const structSchemaEntries = rtti =>
    Object.entries(rtti)

/**
 * Every index below `length` at which `value` reads something, ascending.
 *
 * Bounded by what the value **carries** rather than by `length`: an index that
 * reads a value is an own property of the array, so enumerating its own names
 * finds every one without materializing the range. Walking `0 … length - 1`
 * instead turned a `new Array(2 ** 32 - 1)` — which carries one own property,
 * `length` — into billions of iterations before any check could reject it.
 *
 * The own names **are** the answer, already in the order wanted:
 * `[[OwnPropertyKeys]]` yields integer indices ascending and without repeats,
 * so the walk is one linear pass and needs neither a dedup nor a sort. Adding
 * either made every `array(t)` read quadratic in its length: 829 ms at 40 000
 * elements against 3 ms at 1 000.
 *
 * No `in` test: a name reached this way is an own property of the value, so
 * the array reads at it by construction.
 *
 * @type {(value: ReadonlyArray<Unknown>) => readonly number[]}
 */
const readIndices = value => {
    const { length } = value
    return Object.getOwnPropertyNames(value).flatMap(k => {
        const i = arrayIndex(k)
        return i !== null && i < length ? [i] : []
    })
}

/**
 * The members of `value` that `declared` does not admit — every one the
 * schema's `rest` has to answer for, as `[key, value]` pairs.
 *
 * `declared` tests membership in a container schema's own keys, so for a
 * struct these are its undeclared own keys, and for a tuple they are the
 * positions past the prefix together with every own key that is no position
 * at all.
 *
 * **A tuple's positions are read, not enumerated.** `length` is what says how
 * far an array reaches, and every own index below it is a member the `rest`
 * must answer for ({@link readIndices} is the walk). A genuinely absent index
 * is skipped: a hole is no member, so it meets no `rest` — the same rule the
 * struct kind states by walking own keys.
 *
 * An index at or above `length` is not answered here. See "The members a
 * value carries" in `./README.md`.
 *
 * Passing {@link noDeclared} asks for every member, which is what the uniform
 * `array`/`record` readers want — so they share this walk rather than reaching
 * for `Object.entries` and disagreeing with the data form on an inherited
 * index.
 *
 * `declared` is a **membership test**, built once per schema by
 * {@link declaredTest}, for the reason {@link hasUndeclaredMember} gives: asked
 * per member, a scan of the declared names made the walk quadratic in a dense
 * tuple, whose own index `i` sits at position `i` of that list. With the test,
 * the walk is linear in the members of `value`.
 *
 * @type {(declared: (k: string) => boolean, value: ReadonlyArray<Unknown> | StringMap<Unknown>) => ReadonlyArray<readonly [string, Unknown]>}
 */
export const undeclaredMembers = (declared, value) => {
    /** @type {(k: string) => boolean} */
    const undeclared = k => !declared(k)
    if (!commonIsArray(value)) {
        return Object.entries(value).filter(([k]) => undeclared(k))
    }
    return [
        ...readIndices(value)
            .filter(i => undeclared(String(i)))
            .map(i => /** @type {const} */ ([String(i), value[i]])),
        ...Object.entries(value).filter(([k]) => arrayIndex(k) === null && undeclared(k)),
    ]
}

/**
 * Whether `value` carries any member `declared` does not name — the same
 * question {@link undeclaredMembers} answers, for a caller that needs only
 * the yes or no.
 *
 * It exists to **stop early**. A closed container's gate asks whether there
 * is an undeclared member at all, and building the list to ask its length
 * makes a value with many of them pay for all of them: an object with 500 000
 * undeclared keys against a one-key struct spent over a second reading and
 * pairing every one, where the first key already settles it. The key set
 * still has to be materialized — JavaScript exposes no lazy own-key walk —
 * but the values are not read and the scan stops at the first hit.
 *
 * `declared` is a **membership test**, not a list, and the caller builds it
 * once per schema: asked per key, a linear scan of the declared names makes
 * the gate quadratic in a large container — a 10 000-member tuple spent
 * 0.5s here against a same-shaped value, for a question that is O(1) a key.
 *
 * `undeclaredMembers` stays for the `rest` readers, which need the pairs.
 *
 * @type {(declared: (k: string) => boolean, value: ReadonlyArray<Unknown> | StringMap<Unknown>) => boolean}
 */
export const hasUndeclaredMember = (declared, value) => {
    /** @type {(k: string) => boolean} */
    const undeclared = k => !declared(k)
    if (!commonIsArray(value)) {
        return Object.keys(value).some(undeclared)
    }
    return readIndices(value).some(i => undeclared(String(i)))
        || Object.keys(value).some(k => arrayIndex(k) === null && undeclared(k))
}

/**
 * The membership test {@link undeclaredMembers} and
 * {@link hasUndeclaredMember} take, over a schema's declared names — built
 * once per schema, so each key costs one lookup.
 *
 * @type {(declared: readonly string[]) => (k: string) => boolean}
 */
export const declaredTest = declared => {
    const names = new Set(declared)
    return k => names.has(k)
}

/**
 * The membership test of a container that declares no member by name — a
 * uniform `array`/`record` — so every member is undeclared.
 *
 * @type {(k: string) => boolean}
 */
export const noDeclared = () => false

/**
 * Whether `rtti` admits **absence** with `visited` already ruled out — the
 * recursive half of {@link admitsAbsence}, carrying the thunks on the current
 * path so a recursive union such as `X = or(X, option)` terminates.
 *
 * @type {(visited: readonly Type[], rtti: Type) => boolean}
 */
const absenceIn = (visited, rtti) => {
    if (typeof rtti !== 'function') { return false }
    if (visited.some(v => v === rtti)) { return false }
    const [tag, ...operands] = rtti()
    if (tag === 'option') { return true }
    if (tag !== 'or') { return false }
    return operands.some(op => absenceIn([...visited, rtti], op))
}

/**
 * Whether the schema admits **absence** — whether `option` is reachable
 * through its unions, so a container may leave the member out entirely.
 *
 * This is the container loop's question, asked *before* dispatch: a
 * recursive reader is handed only the value read, and an absent key reads
 * `undefined`, so absence cannot be decided downstream of the read. The
 * predicate traverses nested `or` nodes — the schema-form `or` does no
 * flattening, so `or(or(option, number), string)` has no `option` among its
 * direct members while admitting absence — descends the thunks they hold,
 * stops at any other tag, and carries the visited thunks to terminate on a
 * recursive `X = or(X, option)`. The data form needs no such traversal:
 * `toData` has already flattened, so its readers test one unit bit.
 *
 * @type {(rtti: Type) => boolean}
 */
export const admitsAbsence = rtti => absenceIn([], rtti)

/**
 * The shared answer for a declared member that is not there — no own or
 * inherited key at its position: the member is legal exactly when its schema
 * admits absence. The `ok` payload is unused by pass/fail callers and is not
 * a value read from the container, absence being the whole point.
 *
 * @type {(rtti: Type) => ResultE}
 */
export const absentMember = rtti =>
    admitsAbsence(rtti) ? ok(undefined) : verror('unexpected value')

/**
 * `eachEntry`'s accumulate step for a walk that collects nothing — only
 * pass/fail matters.
 *
 * @type {() => undefined}
 */
export const noAccumulate = () => undefined

/**
 * `cons` over a container's declared members, passing the absent ones by: a
 * legally absent member is collected by nothing, so what a reader builds
 * omits it rather than materializing it as `undefined`.
 *
 * @type {<A>(cons: Reader<A>['cons'], value: ReadonlyArray<Unknown> | StringMap<Unknown>) => Reader<A>['cons']}
 */
const consPresent = (cons, value) => (acc, k, v) => k in value ? cons(acc, k, v) : acc

/**
 * The container handler for `array` and `record` schemas: every member of the
 * value is read as `item`. `finish` builds the result from what `reader`
 * collected.
 *
 * The item reader is instantiated lazily, only once the container is known to
 * have a member to read: an empty container never asks for it, so a recursive
 * schema such as `const list = () => ['array', list]` does not recurse forever.
 *
 * The members are `undeclaredMembers`', not `Object.entries`': `array(t)` is
 * `rest([], t)`, so the two have to walk a value the same way. An own-entry
 * walk here skipped an index the prototype supplies while the data form's
 * reader found it, which broke the acceptance agreement the three readers are
 * pinned on.
 *
 * `restFits` bounds the array kind's length when its element set admits
 * nothing, which is what the data form says by normalizing such a `rest`
 * away: an `array(or())` is the *empty* array and not "any number of holes".
 * It is consulted only where it can change the answer — no member present,
 * and the value reaching further than that — so an ordinary array never asks.
 * The readers build it over the data form's `emptyRest` and pass it in: this
 * module must not import `../data/module.f.mjs`, which imports it.
 */
export const containerRead =
    /**
     * @template A
     * @param {Reader<A>} reader
     * @returns {<C extends ReadonlyArray<Unknown> | StringMap<Unknown>>(isContainer: IsContainer<C>, restFits: (item: Type) => Fits<C>, finish: Finish<C, A>) => (item: Type) => ValidateE}
     */
    ({ read, empty, cons }) =>
    (isContainer, restFits, finish) =>
    item => {
        // Depends on the schema alone, so it is built once per schema rather
        // than once per value read.
        const fits = restFits(item)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const e = undeclaredMembers(noDeclared, value)
            if (e.length === 0) {
                return fits(value, 0) ? ok(finish(empty, value)) : verror('unexpected value')
            }
            const itemRead = read(item)
            const r = eachEntry(e, (_k, v) => itemRead(v), empty, cons)
            return r[0] === 'error' ? r : ok(finish(r[1], value))
        }
    }

/**
 * The container handler for `Tuple` and `Struct` const schemas — **closed**:
 * the members the schema declares and no others. It settles the container's
 * shape, then reads each declared member, then lets `finish` build the result
 * from what `reader` collected.
 *
 * `fits` is the one thing the two kinds do not share. An undeclared member is
 * a member on both, but an array is also *as long as it is*: a hole past the
 * prefix is no member and would slip through the member check alone, so the
 * array kind answers with its length as well.
 *
 * A declared member is **absent** when its key or index is neither an own
 * property nor an inherited one — HasProperty, since `getItem` reads through
 * the prototype, so a member the prototype supplies is still held to what the
 * schema says a present value is. Absence is decided here, before dispatch:
 * the recursive reader is handed only the value read, and an absent key reads
 * `undefined`, so it cannot tell `{}` from `{ a: undefined }`. An absent
 * member is legal exactly when its schema admits absence ({@link admitsAbsence})
 * and is collected by nothing; a present one is read and collected.
 *
 * **The order.** The shape is settled before any member is read: the value is
 * bounded, an illegal absence is rejected, an undeclared member is rejected —
 * and only then are the members read. That order is what makes an `or` of two
 * arities linear instead of 2^depth, which is the shape a schema uses to say a
 * trailing operand may be left out (`fjs/edag`'s chain nodes). The bound
 * settles the arm whose value has too much — an extra index, an undeclared
 * key — and the absence pass settles the arm whose value has too little.
 * Neither alone suffices, and each was measured missing: without the bound,
 * and without deciding absence early, a chain stays exponential in one
 * direction or the other. It is also what decides which error a value failing
 * several ways reports, so both readers report the same one.
 *
 * Reading `length` and enumerating the keys before the members assumes those
 * reads have no effect — true of every DataJS value, and the assumption the
 * readers are written under. What that gives up for a value built by arbitrary
 * JavaScript is stated in "What the readers assume of a value" in
 * `../README.md`.
 */
export const constContainerRead =
    /**
     * @template A
     * @param {Reader<A>} reader
     * @returns {<C extends ReadonlyArray<Unknown> | StringMap<Unknown>, S extends ConstObject>(isContainer: IsContainer<C>, schemaEntries: SchemaEntries<S>, getItem: (value: C, k: string) => Unknown, fits: Fits<C>, finish: Finish<C, A>) => (rtti: S) => ValidateE}
     */
    ({ read, empty, cons }) =>
    (isContainer, schemaEntries, getItem, fits, finish) =>
    rtti => {
        // Depend on `rtti` alone, so they are computed once per schema rather
        // than once per value read.
        const rttiEntries = schemaEntries(rtti)
        const declared = rttiEntries.map(([k]) => k)
        // One lookup per key at the gate, rather than a scan of `declared`.
        const isDeclared = declaredTest(declared)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            // The structural questions run cheapest-first, since any of them
            // settles the container and none of them recurses: `fits` reads
            // one `length`; the absence pass probes and consults the schema
            // once per *declared* member; only the undeclared check
            // enumerates the **value's** keys, which is O(its size) and has no
            // lazy form in JavaScript — `Object.keys` on 500 000 keys is 185ms
            // whether or not the scan stops at the first. So a value one
            // question answers never pays for the ones after it, and the
            // constant-time bound precedes everything else.
            if (!fits(value, declared.length)) {
                return verror('unexpected value')
            }
            // Reaching an illegal absence through the reading walk would
            // first recurse into the members that come before it, and those
            // are the operands the longer arm shares — so the two arms would
            // walk them once each at every level, which is the exponential
            // all over again. Measured on a chain of `['.', exp, index]` with
            // a leaf no arm accepts: 2.5s at depth 16 without this.
            //
            // The pass carries nothing forward, so it stops at the first
            // illegal absence having touched only the members before it: a
            // 500 000-position schema against `[]` answers at index 0. The
            // reading walk asks `in` again — to read a member and to collect
            // it — rather than being handed a recorded flag: a `HasProperty`
            // on a value whose reads have no effect, which is the assumption
            // stated in `../README.md`, and cheaper than a list the
            // short-circuit would waste.
            const a = eachEntry(
                rttiEntries,
                (k, t) => k in value ? ok(undefined) : absentMember(t),
                undefined,
                noAccumulate,
            )
            if (a[0] === 'error') { return a }
            if (hasUndeclaredMember(isDeclared, value)) {
                return verror('unexpected value')
            }
            const r = eachEntry(
                rttiEntries,
                // Absence is settled above, so an absent member here is legal.
                (k, t) => k in value ? read(t)(getItem(value, k)) : ok(undefined),
                empty,
                consPresent(cons, value),
            )
            return r[0] === 'error' ? r : ok(finish(r[1], value))
        }
    }

/**
 * The container handler for a schema with a stated `rest`. The declared
 * members are read as the bare form reads them, and every member the schema
 * does not name is held to `rest`: checked, and collected by nothing, since
 * `rest` says what an undeclared member must be and not that a result should
 * carry it.
 *
 * **The order** is not the bare form's. The declared members are read
 * **first**, absence decided inline as the walk reaches each one; only then
 * are the undeclared members computed, and held to `rest` — or, where there
 * are none, to `restFits`. A value failing both ways therefore reports its
 * declared member, not its leftover. The two orders are kept apart on
 * purpose: reading either shape in the other's order would change which
 * error such a value reports.
 *
 * `restFits` carries the array kind's length bound, which a `rest` removes
 * only while it admits something. An empty one says what the bare form says,
 * so `rest(c, or())` and `c` stay one set — the criterion for "empty" is the
 * data form's `emptyRest`, and it is consulted only when nothing is present
 * past the prefix, since a member that got there and passed is itself the
 * proof that the rest admits something. As for {@link containerRead}, the
 * readers build it and pass it in.
 */
export const restContainerRead =
    /**
     * @template A
     * @param {Reader<A>} reader
     * @returns {<C extends ReadonlyArray<Unknown> | StringMap<Unknown>, S extends ConstObject>(isContainer: IsContainer<C>, schemaEntries: SchemaEntries<S>, getItem: (value: C, k: string) => Unknown, restFits: (rtti: S, r: Type) => Fits<C>, finish: Finish<C, A>) => (rtti: S, r: Type) => ValidateE}
     */
    ({ read, empty, cons }) =>
    (isContainer, schemaEntries, getItem, restFits, finish) =>
    (rtti, r) => {
        // Depend on the schema alone, so they are computed once per schema.
        const rttiEntries = schemaEntries(rtti)
        const declared = rttiEntries.map(([k]) => k)
        const isDeclared = declaredTest(declared)
        const fits = restFits(rtti, r)
        return value => {
            if (!isContainer(value)) {
                return verror('unexpected value')
            }
            const d = eachEntry(
                rttiEntries,
                (k, t) => k in value ? read(t)(getItem(value, k)) : absentMember(t),
                empty,
                consPresent(cons, value),
            )
            if (d[0] === 'error') { return d }
            const extra = undeclaredMembers(isDeclared, value)
            if (extra.length === 0) {
                if (!fits(value, declared.length)) {
                    return verror('unexpected value')
                }
            } else {
                const restRead = read(r)
                const e = eachEntry(extra, (_k, v) => restRead(v), undefined, noAccumulate)
                if (e[0] === 'error') { return e }
            }
            return ok(finish(d[1], value))
        }
    }

/**
 * First variant in `variants` that `recurse` accepts, else `verror('no match')`.
 *
 * Shared `or` handler: try each variant against the value and return the
 * first `'ok'` verbatim, parameterized by the recursive function that walks
 * each variant. `recurse`
 * is typed over the erased `ValidateE` alias — annotating it as `(t: Type) =>
 * Validate<Type>` would itself instantiate `Validate<Type>` and hit TS2589 —
 * so each caller passes its recursive function through one boundary cast.
 *
 * @type {(recurse: (t: Type) => ValidateE) => (variants: readonly Type[]) => (value: Unknown) => ResultE}
 */
export const orVisit =
    recurse =>
    variants => value => {
        for (const t of variants) {
            const r = recurse(t)(value)
            if (r[0] === 'ok') {
                return r
            }
        }
        return verror('no match')
    }

/**
 * Visits a schema `Type` by dispatching to the matching handler in `v`.
 *
 * - `Thunk` schemas are evaluated once to read the `Info` descriptor, then
 *   routed by tag (`'const'`, `'array'`, `'record'`, `'unknown'`, `'or'`,
 *   `'rest'`, or a `Tag0` primitive).
 * - `Const` schemas (primitives, tuples, structs) are routed directly to
 *   `tuple`, `struct`, or `constPrimitive`.
 */
export const visit =
    /**
     * @template R
     * @param {Visitor<R>} v
     * @returns {(rtti: Type) => R}
     */
    v => rtti => {
        if (typeof rtti === 'function') {
            const [tag, ...value] = rtti()
            switch (tag) {
                case 'const': {
                    const [c] = value
                    // `Type` is `Const | Thunk`, and a `Thunk` is a function, so
                    // this is exactly the check that defines `Const`.
                    assert(typeof c !== 'function', c)
                    return visitConst(v)(c)
                }
                case 'array': return v.array(value[0])
                case 'record': return v.record(value[0])
                case 'unknown': return v.unknown()
                case 'option': return v.option()
                case 'or': return v.or(value)
                case 'rest': {
                    const [c, r] = value
                    // `rest`'s container is a `ConstObject`, which is exactly
                    // the non-null objects among the `Const`s — a `Thunk` is a
                    // function, and every other `Const` is a primitive.
                    assert(typeof c === 'object' && c !== null, c)
                    return v.rest(c, r)
                }
            }
            return v.primitive0(tag)
        }
        return visitConst(v)(rtti)
    }

/** A bare tuple fits when it is no longer than declared. @type {Fits<ReadonlyArray<Unknown>>} */
const tupleFits = (value, declared) => value.length <= declared

/** An object fits whatever keys it holds besides the declared ones. @type {Fits<StringMap<Unknown>>} */
const objectFits = () => true

/** @type {(value: ReadonlyArray<Unknown>, k: string) => Unknown} */
const tupleItem = (value, k) => value[Number(k)]

/** @type {(value: StringMap<Unknown>, k: string) => Unknown} */
const structItem = (value, k) => value[k]

/**
 * A schema-form reader, whole: from what it collects of a container's members
 * (`empty` and `cons`, as a {@link Reader} has them) and what it builds of each
 * container kind once they are read (`finish`), the recursive function from a
 * schema to its `ValidateE`. `validate` and `parse` are each one call of it.
 *
 * Everything else is the same for both, so it is written here once: the three
 * container skeletons instantiated per kind, with the container test, the
 * member accessor and the fit each kind is read with; the `rest` dispatch
 * between a tuple and a struct; the `or`; and the handlers that read no
 * container. So the readers agree on a container's shape by construction, not
 * by keeping two instantiations alike.
 *
 * `emptyRest` decides when a rest admits nothing, which the array kind's
 * length bound needs: an `array(or())` is the empty array and not any number
 * of holes, and a `rest` whose set is empty bounds a tuple as the bare form
 * does. It is the data form's (`../data/module.f.mjs`), and it is an argument
 * because that module imports this one.
 *
 * @template A
 * @param {Omit<Reader<A>, 'read'>} collect
 * @param {Finishes<A>} finish
 * @param {(c: ConstObject, r: Type) => boolean} emptyRest
 * @returns {(rtti: Type) => ValidateE}
 */
export const readerOf = ({ empty, cons }, finish, emptyRest) => {
    /** @type {(rtti: Type) => ValidateE} */
    const read = rtti => visit(visitor)(rtti)
    /** @type {Reader<A>} */
    const reader = { read, empty, cons }
    /** @type {(c: ConstObject, r: Type) => Fits<ReadonlyArray<Unknown>>} */
    const tupleRestFits = (c, r) => (value, declared) => value.length <= declared || !emptyRest(c, r)
    const container = containerRead(reader)
    const constContainer = constContainerRead(reader)
    const restContainer = restContainerRead(reader)
    const restTuple = restContainer(isArray, tupleSchemaEntries, tupleItem, tupleRestFits, finish.tuple)
    const restStruct = restContainer(isObject, structSchemaEntries, structItem, () => objectFits, finish.struct)
    /** @type {Visitor<ValidateE>} */
    const visitor = {
        tuple: constContainer(isArray, tupleSchemaEntries, tupleItem, tupleFits, finish.tuple),
        struct: constContainer(isObject, structSchemaEntries, structItem, objectFits, finish.struct),
        rest: (c, r) => c instanceof Array ? restTuple(c, r) : restStruct(c, r),
        array: container(isArray, item => tupleRestFits([], item), finish.array),
        record: container(isObject, () => objectFits, finish.record),
        or: orVisit(read),
        constPrimitive: constPrimitiveValidate,
        primitive0: primitive0Validate,
        unknown: () => ok,
        // Absence is decided by the container loop before dispatch, so a value
        // that reaches this handler is present — and no present value is
        // absent. An ordinary error is what lets `orVisit` try the other
        // members of `or(option, t)`.
        option: () => () => verror('unexpected value'),
    }
    return read
}
