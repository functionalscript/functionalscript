/**
 * JavaScript immutable arrays.
 *
 * @module
 *
 * @import { FixedArray } from './types.ts'
 */

import { toArray, repeat as listRepeat } from '../list/module.f.mjs'
import { fromUndefined } from '../nullable/module.f.mjs'

/**
 * @type {(value: unknown) => value is readonly unknown[]}
 */
export const isArray = value => value instanceof Array

/**
 * Currently, TypeScript can't narrow the type of `readonly T[]` to
 * `FixedArray<N, T>` only by checking `a.length === n`, so we need a
 * user-defined type guard.
 */
export const isFixedArray =
    /**
     * @template {number} N
     * @param {N} n
     */
    n =>
    /**
     * @template T
     * @param {readonly T[]} a An array of unknown length.
     * @return {a is FixedArray<N, T>} True if `a` has length `n`, and `a` is
     * narrowed to `FixedArray<N, T>` in that case.
     */
    a =>
        a.length === n

/**
 * @type {<T>(a: readonly T[]) => readonly T[]}
 */
const uncheckTail = a => a.slice(1)

/**
 * @type {<T>(a: readonly T[]) => readonly T[]}
 */
const uncheckHead = a => a.slice(0, -1)

/**
 * @type {(i: number) => <T>(a: readonly T[]) => T | null}
 */
export const at = i => a => fromUndefined(a[i])

export const first = at(0)

/**
 * @type {<T>(a: readonly T[]) => T | null}
 */
export const last = a => at(a.length - 1)(a)

/**
 * Applies `f` to a non-empty array, answering `null` for an empty one — the
 * shared shape of the whole-array accessors below.
 *
 * The guard is `a.length === 0` and not `first(a) === null`: `first` goes
 * through `fromUndefined`, so it reads a *stored* `null` or `undefined`
 * element as absence. `[null]` is not empty, but `first` says it is.
 *
 * For the same reason `splitFirst`/`splitLast` take their element by index
 * rather than projecting `first`/`last` through `nullable`'s `map`: their
 * result tells "present and nullish" apart from "empty" — `[null, []]` is not
 * `null` — where `at`/`first`/`last`, answering `T | null`, cannot.
 *
 * @type {<T, R>(f: (a: readonly T[]) => R) => (a: readonly T[]) => R | null}
 */
const onNonEmpty = f => a => a.length === 0 ? null : f(a)

/**
 * @type {<T>(a: readonly T[]) => readonly T[] | null}
 */
export const tail = onNonEmpty(uncheckTail)

/**
 * @type {<T>(a: readonly T[]) => readonly [T, readonly T[]]}
 */
const uncheckSplitFirst = a => [a[0], uncheckTail(a)]

/**
 * @type {<T>(a: readonly T[]) => readonly [T, readonly T[]] | null}
 */
export const splitFirst = onNonEmpty(uncheckSplitFirst)

/** @type {<T>(a: readonly T[]) => readonly T[] | null} */
export const head = onNonEmpty(uncheckHead)

/**
 * @type {<T>(a: readonly T[]) => readonly [readonly T[], T]}
 */
const uncheckSplitLast = a => [uncheckHead(a), a[a.length - 1]]

/** @type {<T>(a: readonly T[]) => readonly [readonly T[], T] | null} */
export const splitLast = onNonEmpty(uncheckSplitLast)

/**
 * An empty immutable array.
 *
 * Two JavaScript empty arrays are different and has to have two different values.
 * Usually, it requires memory allocation. If we use the same an empty array everywhere,
 * we may minimize memory a number of memory allocations.
 */
export const empty = /** @type {const} */([])

export const includes =
    /**
     * @template I
     * @template {readonly I[]} T
     * @param {T} a
     */
    a =>
    /**
     * @param {I} v
     * @return {v is T[number]}
     */
    v =>
    a.includes(v)

export const repeat =
    /**
     * @template {number} N
     * @param {N} n
     */
    n =>
    /**
     * @template T
     * @param {T} v
     * @return {FixedArray<N, T>}
     */
    v => /**@type{any}*/(toArray(listRepeat(v)(n)))
