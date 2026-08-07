import { history, historyStep, mapStep, pure, type Effect, type Operation } from '../module.f.mjs'

/**
 * A fluent, method-chaining monad over a raw {@link Effect} that also
 * accumulates the history of every value the chain has produced. `.step(f)`
 * is bind — `f` receives the current value followed by every prior value,
 * most recent first (`f(t, ...p)`), and returns a raw `Effect`; `.step`
 * re-wraps the result together with that history so `.step(f).step(g)`
 * chains and stays in the `Eff` world throughout. `.map(f)` is the functor
 * map — the same thing for an `f` that returns a plain value rather than an
 * effect, so it is exactly `.step((...tp) => pure(f(...tp)))`. `P` is the
 * tuple of prior values available to the *next* `.step` call; it grows by one
 * element (the current `T`) on every step, starting empty at {@link eff}.
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
 * {@link eff} stores what it was handed rather than rebuilding it from the
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
 * {@link eff} spells `readonly[]` itself.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (...tp: readonly[T, ...P]) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
    readonly map: <R>(f: (...tp: readonly[T, ...P]) => R) => Eff<O, R, readonly[T, ...P]>
}

/**
 * Builds an `Eff` from two views of the same chain: `value`, the effect for the
 * current value alone, and `h`, a thunk for the `[current, ...history]` tuple.
 *
 * **The two must denote the same computation** — `value` has to be what `h()`
 * produces with the history dropped. Nothing enforces it. The
 * redundancy is deliberate: `value` used to be derived from `h` on demand,
 * which made disagreement impossible but also forced the entry case to rebuild
 * an effect it was already holding. Passing it in is what lets {@link eff} hand
 * the original back.
 *
 * The asymmetry between the two — one built, one deferred — is the point.
 * `value` is either already in hand ({@link eff} was given it) or already built
 * (`.step` has just composed the chain it projects from), so storing it costs
 * no more than the projection itself. `h` is different: nothing needs the
 * history tuple until a later `.step` asks for it, and composing effects is
 * eager, so holding a thunk is the only way to not compose it yet. That keeps
 * `eff(e)` free of work entirely.
 *
 * `.step` calls `h()` once and closes over the effect, so everything built
 * from that link shares it. `eff`'s thunk is not memoized, so calling `.step`
 * twice on the same `eff(e)` rebuilds and re-forces `e` — harmless under
 * `Pure`'s contract, which requires the thunk to be pure and to tolerate
 * repeat calls.
 */
const create = <O extends Operation, T, P extends readonly unknown[]>(
    value: Effect<O, T>,
    h: () => Effect<O, readonly[T, ...P]>): Eff<O, T, P> => {
    // `self` is named so `.map` can be *defined* as the `.step` call it is
    // documented to equal, rather than as a second copy of `.step`'s body that
    // has to be re-checked against it.
    const self: Eff<O, T, P> = {
        value,
        step: f => {
            const x1 = historyStep(h(), f)
            return create(mapStep(x1, ([t]) => t), () => x1)
        },
        map: f => self.step((...tp) => pure(f(...tp)))
    }
    return self
}

/**
 * Wraps a raw {@link Effect}; the bridge into the `Eff` world, with an empty
 * history. The empty tuple is spelled out because {@link Eff} deliberately has
 * no default for `P` — see its docs.
 */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T, readonly[]> =>
    create(value, () => history(value))
