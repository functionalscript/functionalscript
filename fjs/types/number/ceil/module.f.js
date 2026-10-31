/**
 * Round a number toward positive infinity using compiler-compatible operators.
 *
 * @module
 */

/**
 * Matches `Math.ceil(x)` for numeric inputs, including `NaN`, infinities,
 * and signed zeros. The input must be a number; this helper does not perform
 * `Math.ceil`'s conversion of other types.
 *
 * @type {(x: number) => number}
 */
export const ceil = x => {
    const remainder = x % 1
    if (remainder === 0 || remainder !== remainder) { return x }
    const integer = x - remainder
    return x > 0 ? integer + 1 : integer === 0 ? -0 : integer
}
