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
 * A `Proxy` whose `get` trap answers `toString` and forwards every other
 * key, so every host conversion (`String(f)`, `f + ''`, `[f].join()`, `+f`)
 * reaches the text through `OrdinaryToPrimitive`. `text` runs at each
 * conversion, not here, and answers `undefined` for a text it refuses: the
 * conversion then throws.
 *
 * @type {<F extends Callable>(f: F, text: () => string | undefined) => F}
 */
export const withText = (f, text) => {
    const toString = () => {
        const t = text()
        if (t === undefined) { throw new TypeError('Cannot convert a function to its text') }
        return t
    }
    return new Proxy(f, {
        get: (target, key, receiver) => key === 'toString' ? toString : Reflect.get(target, key, receiver),
    })
}
