/**
 * Effectful cons-list construction.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Operation } from "../types.ts"
 * @import { Effect } from "../types.ts"
 * @import { List } from "../../types/list/types.ts"
 * @import { EffectList, Next } from "./types.ts"
 */

import { pureOk } from "../module.f.mjs"
import { next } from "../../types/list/module.f.mjs"
import { ok } from "../../types/result/module.f.js"

/**
 * The empty `EffectList`: a pure end-of-stream marker (`undefined`).
 *
 * The explicit `Effect<O, Next<O, T, E>, E>` return type lets the contextual
 * type drive the check, so the recursive payload type-checks without a cast.
 * Construct streams through these two combinators, and end a stream that
 * *failed* with `pureError` rather than with either of them.
 *
 * Note: the expanded type is written out because TypeScript cannot convert
 *       `pureOk(...)` to `EffectList<O, T, E>`.
 *
 * @type {<O extends Operation, T, E>() => Effect<O, Next<O, T, E>, E>}
 */
export const empty = () =>
    pureOk(undefined)

/**
 * Prepends `first` to an {@link EffectList} `tail`, as a pure cons cell. `tail`
 * is an ordinary argument, so it is built before the cell is — see
 * {@link Next}.
 *
 * @type {<O extends Operation, T, E>(first: T, tail: EffectList<O, T, E>) => Effect<O, Next<O, T, E>, E>}
 */
export const nonEmpty = (first, tail) =>
    pureOk({ first, tail })

/**
 * A strict list as a stream: one pure cell per item, each made as the
 * consumer reaches it, so a list longer than an array would hold is streamed
 * as it is and never built whole. Pure cells issue no command, which is
 * what lets a producer that already has its bytes — a blob read out of a
 * Git object — answer the `EffectList` a consumer of `Cas<O>.read` expects.
 *
 * @template {Operation} O
 * @template T
 * @template E
 * @param {List<T>} list
 * @returns {Effect<O, Next<O, T, E>, E>}
 */
export const fromList = list => () => {
    const n = next(list)
    return ok(n === null ? undefined : { first: n.first, tail: /** @type {EffectList<O, T, E>} */ (fromList(n.tail)) })
}
