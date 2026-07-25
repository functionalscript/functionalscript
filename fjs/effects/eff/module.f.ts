import { frameStep, pure, step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect} that also
 * accumulates the history of every value the chain has produced. `.step(f)`
 * is bind — `f` receives the current value followed by every prior value,
 * most recent first (`f(t, ...p)`), and returns a raw `Effect`; `.step`
 * re-wraps the result together with that history so `.step(f).step(g)`
 * chains and stays in the `Eff` world throughout. `P` is the tuple of prior
 * values available to the *next* `.step` call; it grows by one element (the
 * current `T`) on every step, starting empty at {@link eff}. `.result()` is
 * the exit back to a raw `Effect`, discarding the history. An `Eff` is not
 * assignable to `Effect`; unwrap with `.result()`.
 *
 * `.result()` is a method rather than a property because unwrapping generally
 * costs a `step` — dropping the history tuple down to its current value. As a
 * property that step would be built on every `.step` call, including the
 * intermediate links that are never unwrapped; as a method it is paid once,
 * at the boundary where the chain actually exits.
 *
 * At the entry it costs nothing at all: `eff(e).result()` returns `e` itself,
 * because {@link eff} keeps `e` as the `result` thunk instead of rebuilding it
 * from the history. Wrapping and unwrapping round-trip to identity, so passing
 * a raw `Effect` through `Eff` and taking it straight back out is free. And
 * since neither thunk is called at construction, an `Eff` that is built and
 * never used builds nothing — `eff(e)` does not compose, and therefore does not
 * force, `e`.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[] = readonly[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T, ...p: P) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
}

/**
 * Builds an `Eff` from two thunks over the same chain: `result`, yielding just
 * the current value, and `both`, yielding the `[current, ...history]` tuple.
 *
 * **The two must denote the same computation** — `result()` has to produce what
 * `both()` produces with the history dropped. Nothing enforces it. The pair is
 * redundant on purpose: `result` used to be derived from `both` (as
 * `step(both, ([t]) => pure(t))`), which made disagreement impossible but also
 * forced the entry case to rebuild an effect it was already holding. Supplying
 * it separately is what lets {@link eff} hand the original back. `.step` still
 * passes the derived form; only `eff` overrides it.
 *
 * Both are thunks so neither is evaluated until the chain is used — `step` is
 * eager, so holding the thunk is the only way to not compose yet. `.step` calls
 * `both()` once and closes over the effect, sharing it with everything built
 * from that link. `eff`'s thunks are not memoized, so calling `.step` twice on
 * the same `eff(e)` rebuilds and re-forces `e`; that is harmless under `Pure`'s
 * contract, which requires the thunk to be pure and to tolerate repeat calls.
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
