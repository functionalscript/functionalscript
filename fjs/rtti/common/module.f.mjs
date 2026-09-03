/**
 * Shared kernel for RTTI consumers.
 *
 * `parse` (`../parse/module.f.mjs`) is the schema-form consumer; the data form
 * (`../data/module.f.mjs`) is the other, walking a `Data` instead of a thunk
 * graph. They produce the same `Result<T, ValidationError>` outcome and differ
 * in how they dispatch, so this module hosts the parts that do not differ:
 *
 * - The error shape (`ValidationError`, `Path`) and path bookkeeping
 *   (`verror`, `prependPath`).
 * - Primitive checks (`primitive0Validate`, `constPrimitiveValidate`).
 * - The `Validate<T>`/`Result<T>` signatures, which `parse` reuses
 *   (`Parse<T> = Validate<T>`).
 * - `visit`: a visitor over the `Type` ADT. Callers supply a `Visitor<R>`
 *   with one handler per variant; `visit(v)(rtti)` recognizes `rtti` and
 *   calls the matching handler. `parse` composes its top-level function from
 *   a visitor.
 * - `eachEntry`: the container entry loop (array/record/tuple/struct). Callers
 *   choose what (if anything) to accumulate, so a caller that only needs
 *   pass/fail pays no allocation per entry.
 * - `tupleSchemaEntries`/`structSchemaEntries`: what a container schema
 *   declares, per kind — the entry list its readers walk.
 * - `undeclaredMembers`: the other half of the loop — the members a container
 *   schema does not name, which a bare schema rejects and a `rest` one holds
 *   to its rest. The data form walks it too, so the two readers state one
 *   rule.
 * - `orVisit`: the shared `or` handler — try each variant's recursive walker,
 *   return the first match.
 *
 * Keeping the kernel here gives schema-driven consumers a stable shared base
 * that does not depend on any one of them.
 *
 * @module
 *
 * @import { Primitive, Unknown } from '../ts/types.ts'
 * @import { Const, Info0, Primitive0, Struct, Tag1, Tuple, Type } from '../types.ts'
 * @import { Error, Result as CommonResult } from '../../types/result/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Validate, Visitor, IsContainer, Container, ResultE, SchemaEntries, ValidateE, ValidationError } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { isArray as commonIsArray } from '../../types/array/module.f.mjs'
import { isObject as commonIsObject } from '../../types/object/module.f.mjs'

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
 * The position `k` names, or `undefined` when `k` names no position at all.
 *
 * Only the canonical spelling of a non-negative integer is an index: `'-1'`,
 * `'01'`, `'1.5'` and `' 1'` are ordinary properties of an array object,
 * however `Number` maps them. Round-tripping the number back through `String`
 * is what rejects every non-canonical spelling at once, rather than one at a
 * time.
 *
 * And only one **below `2 ** 32 - 1`**, which is where the language draws the
 * line rather than a bound chosen here: assigning `a['4294967295']` creates an
 * ordinary enumerable property and leaves `a.length` alone. Reading such a key
 * as an index put it past every `length`-bounded walk *and* past the non-index
 * filter, so it was no member on either path and an undeclared property rode
 * through a closed container.
 *
 * @type {(k: string) => number | undefined}
 */
const arrayIndex = k => {
    const i = Number(k)
    return Number.isInteger(i) && i >= 0 && i < 2 ** 32 - 1 && String(i) === k ? i : undefined
}

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
        return i !== undefined && i < length ? [i] : []
    })
}

/**
 * The members of `value` that `declared` does not name — every one the
 * schema's `rest` has to answer for, as `[key, value]` pairs.
 *
 * `declared` is a container schema's own key list, so for a struct these are
 * its undeclared own keys, and for a tuple they are the positions past the
 * prefix together with every own key that is no position at all.
 *
 * **A tuple's positions are read, not enumerated.** `length` is what says how
 * far an array reaches, and every own index below it is a member the `rest`
 * must answer for ({@link readIndices} is the walk). A genuinely absent index
 * is skipped: a hole is no member, so it meets no `rest` — the same rule the
 * struct kind states by walking own keys.
 *
 * An index at or above `length` is not answered here. See "Beyond `length`" in
 * `../README.md`.
 *
 * Passing an empty `declared` asks for every member, which is what the uniform
 * `array`/`record` readers want — so they share this walk rather than reaching
 * for `Object.entries` and disagreeing with the data form on an inherited
 * index.
 *
 * @type {(declared: readonly string[], value: ReadonlyArray<Unknown> | StringMap<Unknown>) => ReadonlyArray<readonly [string, Unknown]>}
 */
export const undeclaredMembers = (declared, value) => {
    /** @type {(k: string) => boolean} */
    const undeclared = k => !declared.some(d => d === k)
    if (!commonIsArray(value)) {
        return Object.entries(value).filter(([k]) => undeclared(k))
    }
    return [
        ...readIndices(value)
            .filter(i => undeclared(String(i)))
            .map(i => /** @type {const} */ ([String(i), value[i]])),
        ...Object.entries(value).filter(([k]) => arrayIndex(k) === undefined && undeclared(k)),
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
        || Object.keys(value).some(k => arrayIndex(k) === undefined && undeclared(k))
}

/**
 * {@link hasUndeclaredMember}'s membership test over a schema's declared
 * names — built once per schema, so each key costs one lookup.
 *
 * @type {(declared: readonly string[]) => (k: string) => boolean}
 */
export const declaredTest = declared => {
    const names = new Set(declared)
    return k => names.has(k)
}

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
