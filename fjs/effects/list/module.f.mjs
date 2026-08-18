/**
 * Effectful cons-list construction.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { RawEffect, Operation } from "../types.ts"
 * @import { List, Next } from "./types.ts"
 */

import { pure } from "../module.f.mjs"

/**
 * The empty `List`: a pure end-of-stream marker (`undefined`).
 *
 * The explicit `RawEffect<O, Next<O, T>>` return type lets the contextual type drive the
 * check, so the recursive payload type-checks without a cast. Construct streams through
 * these two combinators.
 *
 * Note: we use `RawEffect<O, Next<O, T>>` because TypeScript can't convert `pure(...)` to
 *       `List<O, T>`.
 *
 * @type {<O extends Operation, T>() => RawEffect<O, Next<O, T>>}
 */
export const empty = () =>
    pure(undefined)

/**
 * Prepends `first` to a {@link List} `tail`, as a pure cons cell. `tail` is an
 * ordinary argument, so it is built before the cell is — see {@link Next}.
 *
 * @type {<O extends Operation, T>(first: T, tail: List<O, T>) => RawEffect<O, Next<O, T>>}
 */
export const nonEmpty = (first, tail) =>
    pure({ first, tail })
