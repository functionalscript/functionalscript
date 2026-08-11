/**
 * Types for the immutable list data structure.
 *
 * @module
 */

import type { Nullable } from '../nullable/types.ts'

export type List<T> = NotLazy<T> | Thunk<T>

export type NotLazy<T> = Result<T> | Concat<T> | readonly T[]

export type Empty = null

export type Result<T> = Empty | NonEmpty<T>

export type Thunk<T> = () => List<T>

/**
 * See also https://en.wikipedia.org/wiki/Cons#Lists
 */
export type NonEmpty<T> = {
    readonly first: T
    readonly tail: List<T>
}

export type Concat<T> = {
    readonly head: List<T>
    readonly tail: List<T>
}

/**
 * A fold that can bail out early, packaged as plain data.
 *
 * `init` is the starting state, `update` advances the state by one item and
 * returns `null` to abort the whole fold, and `end` finalizes the surviving
 * state into a result. Keeping the three parts together lets `tryFold` drive
 * any short-circuiting accumulation without knowing its domain.
 */
export type Accumulator<I, T, R> = {
    readonly init: T
    readonly update: (i: I, state: T) => Nullable<T>
    readonly end: (state: T) => R
}

export type Entry<T> = readonly [number, T]
