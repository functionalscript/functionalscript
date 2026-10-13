/**
 * The lesser of two numbers: `Math.min` on two arguments, written with the
 * language's own operators, so a module can import it where the `Math`
 * global is not admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

/**
 * The lesser of `a` and `b`, as `Math.min(a, b)` answers it: `NaN` where
 * either is `NaN`, and `-0` where the two are the zeros, since `-0` is the
 * lesser and `<` cannot tell them apart. `1 / -0` is `-Infinity`, which
 * does tell. A variadic `Math.min(...xs)` is a reduce over this.
 *
 * @type {(a: number, b: number) => number}
 */
export const min = (a, b) =>
    a !== a || b !== b ? NaN
        : a < b ? a
            : b < a ? b
                : a === 0 && (1 / a < 0 || 1 / b < 0) ? -0
                    : a
