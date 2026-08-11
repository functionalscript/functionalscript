/**
 * A fluent, method-chaining wrapper over the raw `Effect`.
 *
 * See `./types.ts` for the `Eff` type-level API.
 *
 * @module
 */
import { history, historyStep, mapStep, pure } from '../module.f.mjs'
/** @import { Effect, Operation } from '../types.ts' */
/** @import { Eff } from './types.ts' */

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
 *
 * @template {Operation} O
 * @template T
 * @template {readonly unknown[]} P
 * @param {Effect<O, T>} value
 * @param {() => Effect<O, readonly[T, ...P]>} h
 * @returns {Eff<O, T, P>}
 */
const create = (value, h) => {
    // `self` is named so `.map` can be *defined* as the `.step` call it is
    // documented to equal, rather than as a second copy of `.step`'s body that
    // has to be re-checked against it.
    /** @type {Eff<O, T, P>} */
    const self = {
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
 *
 * @type {<O extends Operation, T>(value: Effect<O, T>) => Eff<O, T, readonly[]>}
 */
export const eff = value =>
    create(value, () => history(value))
