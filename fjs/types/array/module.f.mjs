/**
 * JavaScript immutable arrays.
 *
 * @module
 */

import { fromUndefined, map } from '../nullable/module.f.mjs'

/** @import { Assert } from '../../asserts/types.d.ts' */
/** @import { Equal } from '../ts/module.f.mjs' */

/**
 * @type {(value: unknown) => value is readonly unknown[]}
 */
export const isArray = value => value instanceof Array

/**
 * @template {number} N
 * @template T
 * @template {readonly T[]} R
 * @typedef {N extends R['length'] ? R : _Tuple<N, T, readonly[...R, T]>} _Tuple
*/

/**
 * @template {number} N
 * @template {readonly unknown[]} R
 * @typedef {R['length'] extends N ? never : R['length'] | _Index<N, readonly[...R, unknown]>} _Index
 */

/**
 * @template {number} N
 * @typedef {number extends N ? number : N extends number ? _Index<N, readonly[]> : never} Index
 */

/**
 * @template {number} N
 * @template T
 * @typedef {_Tuple<N, T, readonly[]>} Tuple
 */

/**
 * @template {readonly unknown[]} T
 * @typedef {Index<T['length']>} KeyOf
 */

/**
 * @typedef {Assert<Equal<KeyOf<readonly number[]>, number>>} _X0
 * @typedef {Assert<Equal<KeyOf<readonly [true]>, 0>>} _X1
 * @typedef {Assert<Equal<KeyOf<readonly [true] | readonly [false, false]>, 0 | 1>>} _X2
 */

/**
 * Currently, TypeScript can't narrow the type of `readonly T[]` to `Array2<T>`
 * only by checking `a.length === 2`, so we need a user-defined type guard.
 */
export const isTuple =
    /**
     * @template {number} N
     * @param {N} n
     */
    n =>
    /**
     * @template T
     * @param {readonly T[]} a An array of unknown length.
     * @return {a is Tuple<N, T>} True if `a` has length 2, and `a` is narrowed to `Array2<T>` in that case.
     */
    a =>
        a.length === n

/**
 * @template T
 * @typedef {Tuple<1, T> | Tuple<2, T> | Tuple<3, T> | Tuple<4, T> | Tuple<5, T>} Array1_5
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
 * @type {<T>(a: readonly T[]) => readonly [T, readonly T[]] | null}
 */
export const splitFirst = a => {
    /** @typedef {(typeof a)[0]} T */
    const split = (/** @type {T} */first) =>
        /** @type {const} */([first, uncheckTail(a)])
    return map(split)(first(a))
}

/** @type {<T>(a: readonly T[]) => readonly T[] | null} */
export const head = a => a.length === 0 ? null : uncheckHead(a)

/** @type {<T>(a: readonly T[]) => readonly [readonly T[], T] | null} */
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
 */
export const empty = /** @type {const} */([])

/**
 * @template I
 * @template {readonly I[]} T
 * @typedef {(v: I) => v is T[number]} Includes
 */

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
