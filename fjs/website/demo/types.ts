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
 * `click` is what a demo uses to ask for work rather than to react to typing:
 * a benchmark should start when a reader says so, not when a page loads. It
 * carries only the name, because a button has no value to report.
 *
 * The union is extended when a demo needs more, and not before.
 */
export type DemoEvent =
    | { readonly kind: 'start' }
    | { readonly kind: 'input', readonly name: string, readonly value: string }
    | { readonly kind: 'click', readonly name: string }

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
 * did not arrive, an operation the runtime cannot perform — is handled by the
 * demo and represented in `State`, where `view` can show it. `never` says the
 * demo absorbs every one of them before returning its next state. A throw is
 * not recoverable: it is a defect, and the runtime reports it as one.
 *
 * **What a demo may name is what the runtime implements**, which is today
 * `sandbox` and `catch` from [`effects/common`](../../effects/common/types.ts)
 * — host-neutral operations a browser has as surely as Node does. A demo that
 * needs nothing declares `never` and returns `pureOk`, which is the same shape
 * with an empty vocabulary rather than a second kind of demo. An operation the
 * runtime does not implement answers `notImplemented` through the demo's own
 * channel, which is what `never` obliges the demo to absorb into `State`.
 *
 * **`wait` is how a demo says what "Working…" does not.** The runtime owns
 * that word, and owns it deliberately: it runs every demo, so the word has to
 * be general. What it cannot know is that *this* demo's next turn is twenty
 * minutes rather than twenty milliseconds, which only the demo can work out
 * from its own state. `wait` answers extra words for that turn, or `null` for
 * the ordinary case, and it is read from the state the demo is about to be
 * given — before the turn, because afterwards is too late to warn anyone.
 *
 * It is pure and optional. A demo that omits it gets the general word, which
 * is the right default: silence here means "nothing unusual", not "nobody
 * remembered".
 */
export type Demo<State, Event, O extends Operation = never> = {
    readonly init: State
    readonly update: (state: State) => (event: Event) => Effect<O, State, never>
    readonly view: (state: State) => Element
    readonly wait?: ((state: State) => string | null) | undefined
}
