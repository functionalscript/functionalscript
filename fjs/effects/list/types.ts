/**
 * Types for the effectful cons-list.
 *
 * @module
 */

import type { RawEffect, Operation } from '../types.ts'

export type NonEmpty<O extends Operation, T> = {
    readonly first: T
    readonly tail: List<O, T>
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
 * `RawEffect<O, Next<O, T>>` is used directly in places where `List<O, T>` cannot
 * be written as a return type (see `empty`).
 */
export type Next<O extends Operation, T> =
    NonEmpty<O, T> | undefined

export type List<O extends Operation, T> =
    RawEffect<O, Next<O, T>>
