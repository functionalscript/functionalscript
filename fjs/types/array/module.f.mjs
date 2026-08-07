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
 * @template {number} N, T
 * @typedef {N extends 0 ? readonly[] : ArrayX<(N - 1), T>} ArrayX
 */

/**
 * @template {readonly unknown[]} P, T
 * @typedef {readonly[...P, T]} Push
 */

/**
 * @template T
 * @typedef {readonly[T]} Array1
 */

/** @typedef {0} Index1 */

/**
 * @template T
 * @typedef {Push<Array1<T>, T>} Array2
 */

/**
 * Currently, TypeScript can't narrow the type of `readonly T[]` to `Array2<T>`
 * only by checking `a.length === 2`, so we need a user-defined type guard.
 *
 * @template T
 * @param {readonly T[]} a An array of unknown length.
 * @returns {a is Array2<T>} True if `a` has length 2, and `a` is narrowed to `Array2<T>` in that case.
 */
export const isArray2 = a => a.length === 2

/**
 * @template T0, T1
 * @typedef {Push<Array1<T0>, T1>} Tuple2
 */

/** @typedef {0|1} Index2 */

/**
 * @template T
 * @typedef {Push<Array2<T>, T>} Array3
 */

/**
 * @template T0, T1, T2
 * @typedef {readonly[T0, T1, T2]} Tuple3
 */

/** @typedef {Index2|2} Index3 */

/**
 * @template T
 * @typedef {readonly[T, T, T, T]} Array4
 */

export type Index4 = Index3 | 3

export type Array5<T> = readonly [T, T, T, T, T]

export type Index5 = Index4 | 4

export type Array8<T> = readonly [T, T, T, T, T, T, T, T]

export type Index8 = Index5 | 5 | 6 | 7

export type Array16<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T]

export type Index16 = Index8 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export type Array1_5<T> = Array1<T> | Array2<T> | Array3<T> | Array4<T> | Array5<T>

export type KeyOf<T> = T extends Array1<infer _> ? Index1 :
    T extends Array2<infer _> ? Index2 :
    T extends Array3<infer _> ? Index3 :
    T extends Array4<infer _> ? Index4 :
    T extends Array5<infer _> ? Index5 :
    T extends Array8<infer _> ? Index8 :
    T extends Array16<infer _> ? Index16 :
    T extends readonly (infer _)[] ? number :
    never

const uncheckTail = <T>(a: readonly T[]): readonly T[] =>
    a.slice(1)

const uncheckHead = <T>(a: readonly T[]): readonly T[] =>
    a.slice(0, -1)

export const at = (i: number) => <T>(a: readonly T[]): T | null =>
    fromUndefined(a[i])

export const first: <T>(_: readonly T[]) => T | null
    = at(0)

export const last = <T>(a: readonly T[]): T | null =>
    at(a.length - 1)(a)

export const tail = <T>(a: readonly T[]): readonly T[] | null =>
    a.length === 0 ? null : uncheckTail(a)

export const splitFirst
    = <T>(a: readonly T[]): readonly [T, readonly T[]] | null => {
        const split = (first: T): readonly [T, readonly T[]] =>
            [first, uncheckTail(a)]
        return map(split)(first(a))
    }

export const head = <T>(a: readonly T[]): readonly T[] | null =>
    a.length === 0 ? null : uncheckHead(a)

export const splitLast
    = <T>(a: readonly T[]): readonly [readonly T[], T] | null => {
        const lastA = last(a)
        if (lastA === null) { return null }
        return [uncheckHead(a), lastA]
    }

/**
 * An empty immutable array.
 *
 * Two JavaScript empty arrays are different and has to have two different values.
 * Usually, it requires memory allocation. If we use the same an empty array everywhere,
 * we may minimize memory a number of memory allocations.
 */
export const empty: readonly[] = []

export type Includes<I, T extends readonly I[]> = (v: I) => v is T[number]

export const includes = <I, T extends readonly I[]>(a: T) => (v: I): v is T[number] =>
    a.includes(v)
