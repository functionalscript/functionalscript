import { frameStep, pure, step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect} that also
 * accumulates the history of every value the chain has produced. `.step(f)`
 * is bind — `f` receives the current value followed by every prior value,
 * most recent first (`f(t, ...p)`), and returns a raw `Effect`; `.step`
 * re-wraps the result together with that history so `.step(f).step(g)`
 * chains and stays in the `Eff` world throughout. `P` is the tuple of prior
 * values available to the *next* `.step` call; it grows by one element (the
 * current `T`) on every step, starting empty at {@link eff}. `.value` is the
 * exit back to a raw `Effect`, discarding the history. An `Eff` is not
 * assignable to `Effect`; unwrap through `.value`.
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
 * history, so wrapping and unwrapping round-trip to identity. `both` is still a
 * thunk, so `eff(e)` composes nothing and never forces `e`: an `Eff` that is
 * built and only read does no work at all.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[] = readonly[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T, ...p: P) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
}

/**
 * Builds an `Eff` from two views of the same chain: `value`, the effect for the
 * current value alone, and `both`, a thunk for the `[current, ...history]`
 * tuple.
 *
 * **The two must denote the same computation** — `value` has to be what
 * `both()` produces with the history dropped. Nothing enforces it. The
 * redundancy is deliberate: `value` used to be derived from `both` on demand,
 * which made disagreement impossible but also forced the entry case to rebuild
 * an effect it was already holding. Passing it in is what lets {@link eff} hand
 * the original back.
 *
 * The asymmetry between the two — one built, one deferred — is the point.
 * `value` is either already in hand ({@link eff} was given it) or already built
 * (`.step` has just composed the chain it projects from), so storing it costs
 * no more than the projection itself. `both` is different: nothing needs the
 * history tuple until a later `.step` asks for it, and {@link step} is eager,
 * so holding a thunk is the only way to not compose it yet. That is what keeps
 * `eff(e)` free of work entirely.
 *
 * `.step` calls `both()` once and closes over the effect, so everything built
 * from that link shares it. `eff`'s thunk is not memoized, so calling `.step`
 * twice on the same `eff(e)` rebuilds and re-forces `e` — harmless under
 * `Pure`'s contract, which requires the thunk to be pure and to tolerate
 * repeat calls.
 */
const create = <O extends Operation, T, P extends readonly unknown[]>(
    value: Effect<O, T>,
    both: () => Effect<O, readonly[T, ...P]>): Eff<O, T, P> =>
({
    value,
    step: f => {
        const x0 = frameStep(
            both(),
            tp => f(...tp))
        const x1 = step(
            x0,
            ({ param, result }) => pure([result, ...param] as const))
        return create(step(x1, ([t]) => pure(t)), () => x1)
    }
})

/** Wraps a raw {@link Effect}; the bridge into the `Eff` world, with an empty history. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> =>
    create(value, () => step(value, v => pure([v])))
