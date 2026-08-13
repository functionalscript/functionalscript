/**
 * Effectful cons-list construction.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 */

import { pure } from "../module.f.mjs"
/** @import { Effect, Operation } from "../types.ts" */
/** @import { List, Next } from "./types.ts" */

/**
 * The empty `List`: a pure end-of-stream marker (`undefined`).
 *
 * The explicit `Effect<O, Next<O, T>>` return type lets the contextual type drive the
 * check, so the recursive payload type-checks without a cast. Construct streams through
 * these two combinators.
 *
 * Note: we use `Effect<O, Next<O, T>>` because TypeScript can't convert `pure(...)` to
 *       `List<O, T>`.
 *
 * @type {<O extends Operation, T>() => Effect<O, Next<O, T>>}
 */
export const empty = () =>
    pure(undefined)

/**
 * Prepends `first` to a {@link List} `tail`, as a pure cons cell. `tail` is an
 * ordinary argument, so it is built before the cell is — see {@link Next}.
 *
 * @type {<O extends Operation, T>(first: T, tail: List<O, T>) => Effect<O, Next<O, T>>}
 */
export const nonEmpty = (first, tail) =>
    pure({ first, tail })
