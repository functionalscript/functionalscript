/**
 * A function value that answers a text: `withText(f, text)` is `f` — calls,
 * `length`, `typeof` — save that converting it to a string answers
 * `text()`. See [README.md](./README.md).
 *
 * @module
 *
 * @import { Callable } from '../length/types.ts'
 */

/**
 * A `Proxy` whose `get` trap answers `toString` and forwards every other key,
 * so every host conversion (`String(f)`, `f + ''`, `[f].join()`) reaches the
 * text through `OrdinaryToPrimitive`. `text` runs at each conversion, not
 * here, and what it throws the conversion throws.
 *
 * @type {<F extends Callable>(f: F, text: () => string) => F}
 */
export const withText = (f, text) => new Proxy(f, {
    get: (target, key, receiver) => key === 'toString' ? text : Reflect.get(target, key, receiver),
})
