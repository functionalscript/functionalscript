/**
 * Types for big-floats built from bigint mantissa and exponent parts.
 */

export type BigFloat = readonly [bigint, number]

/**
 * A binary floating-point format: how many significant bits a value may carry,
 * and the range its exponent may take.
 *
 * `minExp` and `maxExp` are in `BigFloat`'s own units — the exponent of the
 * mantissa's last bit, not of its first. So `minExp` is the exponent of the
 * smallest representable value, and `maxExp` the one the largest finite value
 * carries with a full `precision`-bit mantissa. The other convention (the
 * exponent of the *leading* bit, as IEEE-754 states it) differs by
 * `precision - 1` on one end and `precision` on the other; keeping one set of
 * units is why this type restates them rather than naming IEEE's.
 */
export type Format = {
    readonly precision: number
    readonly minExp: number
    readonly maxExp: number
}
