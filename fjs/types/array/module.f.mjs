/**
 * JavaScript immutable arrays.
 *
 * @module
 */

import { fromUndefined, map } from '../nullable/module.f.mjs'

/**
 * @type {(value: unknown) => value is readonly unknown[]}
 */
export const isArray = value => value instanceof Array

/**
 * @template T
 * @typedef {readonly [T]} Array1
 */

/**
 * @typedef {0} Index1
 */

/**
 * @template T
 * @typedef {readonly [T, T]} Array2
 */

/**
 * Currently, TypeScript can't narrow the type of `readonly T[]` to `Array2<T>`
 * only by checking `a.length === 2`, so we need a user-defined type guard.
 *
 * @param a An array of unknown length.
 * @returns True if `a` has length 2, and `a` is narrowed to `Array2<T>` in that case.
 *
 * @type {<T>(a: readonly T[]) => a is Array2<T>}
 */
export const isArray2 = a => a.length === 2

/**
 * @template T0, T1
 * @typedef {readonly [T0, T1]} Tuple2
 */

/**
 * @typedef {0 | 1} Index2
 */

/**
 * @template T
 * @typedef {readonly [T, T, T]} Array3
 */

/**
 * @template T0, T1, T2
 * @typedef {readonly [T0, T1, T2]} Tuple3
 */

/**
 * @typedef {0 | 1 | 2} Index3
 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T]} Array4
 */

/**
 * @typedef {0 | 1 | 2 | 3} Index4
 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T, T]} Array5
 */

/**
 * @typedef {0 | 1 | 2 | 3 | 4} Index5
 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T, T, T, T, T]} Array8
 */

/**
 * @typedef {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7} Index8
 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T]} Array16
 */

/**
 * @typedef {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15} Index16
 */

/**
 * @template T
 * @typedef {Array1<T> | Array2<T> | Array3<T> | Array4<T> | Array5<T>} Array1_5
 */

/**
 * @template T
 * @typedef {T extends Array1<infer _> ? Index1 :
 *  T extends Array2<infer _> ? Index2 :
 *  T extends Array3<infer _> ? Index3 :
 *  T extends Array4<infer _> ? Index4 :
 *  T extends Array5<infer _> ? Index5 :
 *  T extends Array8<infer _> ? Index8 :
 *  T extends Array16<infer _> ? Index16 :
 *  T extends readonly (infer _)[] ? number :
 *  never} KeyOf
 */

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
 * @type {<T>(a: readonly T[]) => readonly T[] | null}
 */
export const tail = a => a.length === 0 ? null : uncheckTail(a)

/**
 * @template T
 * @param {readonly T[]} a
 * @returns {readonly [T, readonly T[]] | null}
 */
export const splitFirst
    = a => {
        /** @type {(first: T) => readonly [T, readonly T[]]} */
        const split = first => [first, uncheckTail(a)]
        return map(split)(first(a))
    }

/**
 * @type {<T>(a: readonly T[]) => readonly T[] | null}
 */
export const head = a => a.length === 0 ? null : uncheckHead(a)

/**
 * @type {<T>(a: readonly T[]) => readonly [readonly T[], T] | null}
 */
export const splitLast = a => {
    const lastA = last(a)
    return lastA === null ? null : [uncheckHead(a), lastA]
}

/**
 * An empty immutable array.
 *
 * Two JavaScript empty arrays are different and has to have two different values.
 * Usually, it requires memory allocation. If we use the same an empty array everywhere,
 * we may minimize memory a number of memory allocations.
 *
 * @type {readonly []}
 */
export const empty = []

/**
 * @template I
 * @template {readonly I[]} T
 * @typedef {(v: I) => v is T[number]} Includes
 */

/**
 * @template I
 * @template {readonly I[]} T
 * @param {T} a
 */
export const includes = a =>
    /**
     * @param {I} v
     * @returns {v is T[number]}
     */
    v => a.includes(v)