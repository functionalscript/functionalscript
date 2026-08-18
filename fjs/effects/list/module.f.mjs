/**
 * Effectful cons-list construction.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Operation } from "../types.ts"
 * @import { Effect } from "../types.ts"
 * @import { List, Next } from "./types.ts"
 */

import { pureOk } from "../io/module.f.mjs"

/**
 * The empty `List`: a pure end-of-stream marker (`undefined`).
 *
 * The explicit `Effect<O, Next<O, T, E>, E>` return type lets the contextual
 * type drive the check, so the recursive payload type-checks without a cast.
 * Construct streams through these two combinators, and end a stream that
 * *failed* with `pureError` rather than with either of them.
 *
 * Note: the expanded type is written out because TypeScript cannot convert
 *       `pureOk(...)` to `List<O, T, E>`.
 *
 * @type {<O extends Operation, T, E>() => Effect<O, Next<O, T, E>, E>}
 */
export const empty = () =>
    pureOk(undefined)

/**
 * Prepends `first` to a {@link List} `tail`, as a pure cons cell. `tail` is an
 * ordinary argument, so it is built before the cell is — see {@link Next}.
 *
 * @type {<O extends Operation, T, E>(first: T, tail: List<O, T, E>) => Effect<O, Next<O, T, E>, E>}
 */
export const nonEmpty = (first, tail) =>
    pureOk({ first, tail })
