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
 * A `Proxy` whose `get` trap answers `toString` and `Symbol.toPrimitive`
 * and forwards every other key, so every host conversion (`String(f)`,
 * `f + ''`, `[f].join()`, `+f`) reaches the text. `text` runs at each
 * conversion, not here, and answers `undefined` for a text it refuses:
 * the conversion then throws, save a numeric one, which is `NaN` for every
 * function text and so needs none.
 *
 * @type {<F extends Callable>(f: F, text: () => string | undefined) => F}
 */
export const withText = (f, text) => {
    /** @type {(hint: string) => string | number} */
    const toPrimitive = hint => {
        const t = text()
        if (t !== undefined) { return t }
        if (hint === 'number') { return NaN }
        throw new TypeError('Cannot convert a function to its text')
    }
    const toString = () => toPrimitive('string')
    return new Proxy(f, {
        get: (target, key, receiver) =>
            key === 'toString' ? toString
            : key === Symbol.toPrimitive ? toPrimitive
            : Reflect.get(target, key, receiver),
    })
}
