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
 * - `undeclaredEntries`: the other half of a closed container's loop — the
 *   entries a `Tuple`/`Struct` schema does not name.
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
 * @import { Error, Result as CommonResult } from '../../result/types.ts'
 * @import { StringMap } from '../../object/types.ts'
 * @import { Validate, Visitor, IsContainer, Container, ResultE, SchemaEntries, ValidateE, ValidationError } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { error, ok } from '../../result/module.f.mjs'
import { isArray as commonIsArray } from '../../array/module.f.mjs'
import { isObject as commonIsObject } from '../../object/module.f.mjs'

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
 * need the rebuilt `[key, value]` pairs, so they fold them into a `List` (see
 * the call site) and convert to an array once at the end. A caller whose
 * whole question is "did every entry succeed?" passes `undefined`/`acc => acc`
 * instead and pays no allocation per entry.
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
        for (const [k, v] of entries) {
            const r = item(k, v)
            if (r[0] === 'error') {
                return prependPath(k, r)
            }
            acc = accumulate(acc, k, r[1])
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
 * The entries of `value` that `declared` does not name.
 *
 * `declared` is a container schema's own key list, so for a struct these are
 * the undeclared keys, and for a tuple — whose declared keys are the canonical
 * spellings of its positions — they are the positions past the prefix together
 * with every enumerable own key that is no position at all. One filter answers
 * both kinds, which is what lets a closed container be read the same way on
 * each.
 *
 * @type {(declared: readonly string[], value: ReadonlyArray<Unknown> | StringMap<Unknown>) => ReadonlyArray<readonly [string, Unknown]>}
 */
export const undeclaredEntries = (declared, value) =>
    Object.entries(value).filter(([k]) => !declared.some(d => d === k))

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
 *   `'close'`, or a `Tag0` primitive).
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
                case 'or': return v.or(value)
                case 'close': {
                    const [c, rest] = value
                    // `close`'s container is a `ConstObject`, which is exactly
                    // the non-null objects among the `Const`s — a `Thunk` is a
                    // function, and every other `Const` is a primitive.
                    assert(typeof c === 'object' && c !== null, c)
                    return v.close(c, rest)
                }
            }
            return v.primitive0(tag)
        }
        return visitConst(v)(rtti)
    }
