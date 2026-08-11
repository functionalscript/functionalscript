/**
 * Types for the `Eff` fluent, method-chaining monad.
 *
 * @module
 */

import type { Effect, Operation } from '../types.ts'

/**
 * A fluent, method-chaining monad over a raw `Effect` that also
 * accumulates the history of every value the chain has produced. `.step(f)`
 * is bind — `f` receives the current value followed by every prior value,
 * most recent first (`f(t, ...p)`), and returns a raw `Effect`; `.step`
 * re-wraps the result together with that history so `.step(f).step(g)`
 * chains and stays in the `Eff` world throughout. `.map(f)` is the functor
 * map — the same thing for an `f` that returns a plain value rather than an
 * effect, so it is exactly `.step((...tp) => pure(f(...tp)))`. `P` is the
 * tuple of prior values available to the *next* `.step` call; it grows by one
 * element (the current `T`) on every step, starting empty at `eff`.
 * `.value` is the exit back to a raw `Effect`, discarding the history. An
 * `Eff` is not assignable to `Effect`; unwrap through `.value`.
 *
 * **`.map` grows the history just as `.step` does, and does not widen `O`.**
 * Both follow from it being that `.step` call and nothing else: a chain
 * rewritten from `.step(v => pure(f(v)))` to `.map(f)` must hand later
 * callbacks the same prior values it did before, and a projection performs no
 * command, so it contributes no operation for a runner to interpret.
 *
 * **The history is positional, so every parameter a callback declares is
 * meaningful.** `f` is applied as `f(...tp)`, so a callback written
 * `(v, n = 1) => …` or `(v, ...rest) => …` receives prior chain values in `n` /
 * `rest` rather than the default or an empty rest — and where the types line up,
 * TypeScript will not object. Declare exactly as many parameters as the callback
 * intends to read; a defaulted or rest parameter after the current value is a
 * bug, not a convenience. This is what makes `.map(g)` a *different* call from
 * `.step(v => pure(g(v)))` whenever `g` is not genuinely unary — the lambda
 * pins the arity at one, while passing `g` point-free exposes it to the prior
 * values, the way `['1', '2', '3'].map(parseInt)` does.
 *
 * **`.value` is always an already-built `Effect`.** Reading it composes
 * nothing: the projection that drops the history tuple to its current value is
 * performed by the `.step` that produced the link, not deferred to the read.
 * An `Eff` is a record to look into, not an object with a method that quietly
 * does work when called.
 *
 * That costs one projection per link, paid whether or not the link is ever
 * unwrapped — an n-link chain builds n of them where a deferred `.result()`
 * method would build one. It is a constant factor on construction, with no
 * extra forcing of the wrapped effect and no change in growth rate, bought in
 * exchange for a uniform rule at the boundary every caller touches.
 *
 * At the entry it costs nothing at all: `eff(e).value` **is** `e`, because
 * `eff` stores what it was handed rather than rebuilding it from the
 * history, so wrapping and unwrapping round-trip to identity. `h` is still a
 * thunk, so `eff(e)` composes nothing and never forces `e`: an `Eff` that is
 * built and only read does no work at all.
 *
 * **`P` has no default, on purpose.** A default of `readonly[]` would make
 * `Eff<O, T>` a spelling that silently erases history: an
 * `Eff<O, T, readonly[A]>` is assignable to it, because `f` sits in a
 * contravariant position and TypeScript accepts a callback declaring fewer
 * parameters than the type it is checked against. The next `.step` callback
 * would then be typed as receiving no prior values while the runtime still
 * passes them, and any callback destructuring a rest parameter would be handed
 * entries its type says cannot exist. Requiring the third argument means that
 * erasure cannot be written at all, rather than merely being discouraged;
 * `eff` spells `readonly[]` itself.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (...tp: readonly[T, ...P]) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
    readonly map: <R>(f: (...tp: readonly[T, ...P]) => R) => Eff<O, R, readonly[T, ...P]>
}
