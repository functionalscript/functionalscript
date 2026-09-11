/**
 * The type-level API a demo module implements.
 *
 * A demo is what a module *does*, shown on its page: a hash function is best
 * understood by typing into a field and watching the digest change. A module
 * page can already say what a module is and whether it passes; this is the
 * third thing.
 *
 * **A demo is discovered by its export, not its filename**, exactly as a proof
 * is: a module is a demo module if and only if it exports `demo`. `demo.f.mjs`
 * is the preferred home because it keeps view code out of the module's
 * dependency closure, and an inline `export const demo` in `module.f.mjs` is
 * as valid as an inline `proof`.
 *
 * @module
 */

import type { Operation, Effect } from '../../effects/types.ts'
import type { Element } from '../../media/html/types.ts'

/**
 * What the runtime observed, handed back to the demo.
 *
 * `start` arrives once, after the first render, so a demo that needs an
 * operation before it can show anything has somewhere to ask for it without
 * `init` becoming an effect. `input` carries the `name` attribute of the
 * element that changed, which is how a demo tells its fields apart without
 * ever holding a DOM node.
 *
 * The union is extended when a demo needs more, and not before.
 */
export type DemoEvent =
    | { readonly kind: 'start' }
    | { readonly kind: 'input', readonly name: string, readonly value: string }

/**
 * A demo: an initial state, how an event changes it, and what it looks like.
 *
 * `view` answers an `Element` rather than a `Node`, because the runtime
 * replaces the demo section's contents with it: a bare string has no element
 * to replace them with.
 *
 * **`update` returns an `Effect`, so a demo can ask for what it needs** — a
 * clock, a random number, a fetch — while staying FunctionalScript. It
 * describes the operation; the shared runtime performs it and resumes the
 * effect until it yields the next state. A demo that needs nothing declares
 * `O` as `never` and returns `pureOk`, which is the same shape with an empty
 * vocabulary rather than a second convention.
 *
 * **The error channel is `never`, and that is a claim.** A demo has no error
 * display apart from what it renders, so a recoverable failure — a fetch that
 * did not arrive, an operation this runtime does not implement — is handled by
 * the demo and represented in `State`, where `view` can show it. `never` says
 * the demo absorbs every one of them before returning its next state. A throw
 * is not recoverable: it is a defect, and the runtime reports it as one.
 */
export type Demo<State, Event, O extends Operation = never> = {
    readonly init: State
    readonly update: (state: State) => (event: Event) => Effect<O, State, never>
    readonly view: (state: State) => Element
}
