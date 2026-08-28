/**
 * Types for the effectful cons-list.
 */

import type { Operation } from '../types.ts'
import type { Effect, NotImplemented } from '../types.ts'

export type NonEmpty<O extends Operation, T, E> = {
    readonly first: T
    readonly tail: List<O, T, E>
}

/**
 * The payload of a `List` effect: the next cons cell, or `undefined` at
 * end-of-stream.
 *
 * A `List` suspends only where a `Do` node does. `Pure` is a thunk, but that
 * thunk is a discriminator rather than a suspension, and {@link nonEmpty} takes
 * `tail` as an ordinary argument — already evaluated by the time the cell is
 * built. A chain of pure cells is therefore constructed in full, up front;
 * streaming comes from cells produced inside a command's continuation, where
 * the tail is not reached until a runner performs the command.
 *
 * `Effect<O, Next<O, T, E>, E>` is used directly in places where
 * `List<O, T, E>` cannot be written as a return type (see `empty`).
 */
export type Next<O extends Operation, T, E> =
    NonEmpty<O, T, E> | undefined

/**
 * A stream of `T`s, pulled one cell at a time, which may fail with `E`.
 *
 * **The failure belongs to the cell, not to the item.** A producer that cannot
 * deliver ends the stream by failing it, so there is no such thing as a stream
 * that continues after an error and no tail to construct after one. Putting the
 * failure in `T` instead — `List<O, IoResult<Vec>>`, as this used to be — made
 * an `error` item and an `undefined` end-of-stream two values of one union that
 * every consumer had to keep apart by hand, and left a failing producer
 * obliged to supply a tail nobody would ever pull.
 *
 * It also made short-circuiting unfactorable: a combinator generic in `T`
 * cannot look inside it, so every consumer hand-wrote the same
 * `if (t === 'error') return …`. With the failure in the cell, `step` does it.
 *
 * The cost is that a stream can no longer report one bad item and carry on.
 * Nothing wanted that; a reader that did would carry a `Result` in `T`
 * deliberately, which remains expressible and now means what it says.
 */
export type List<O extends Operation, T, E = NotImplemented> =
    Effect<O, Next<O, T, E>, E>
