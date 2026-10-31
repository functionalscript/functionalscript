/**
 * The bigint of an integral number: `BigInt(n)` on a number, written with
 * the language's arithmetic operators. Unlike the `BigInt` conversion
 * operator, this numeric-only helper rejects inputs of other types.
 *
 * @module
 */

/**
 * The bigint of a non-negative integral number, bit by bit from the lowest:
 * a round takes the lowest bit of the rest, `rest % 2`, exact on an integral
 * double, adds it to the result at the bit's weight, and halves the rest,
 * `(rest - bit) / 2`, which drops no bit. One round per bit, at most 1024
 * for the largest double, in one loop over one variable, the state.
 *
 * @type {(n: number) => bigint}
 */
const bits = n => {
    let s = { rest: n, result: 0n, weight: 1n }
    while (s.rest !== 0) {
        const bit = s.rest % 2
        s = {
            rest: (s.rest - bit) / 2,
            result: bit === 0 ? s.result : s.result | s.weight,
            weight: s.weight << 1n,
        }
    }
    return s.result
}

/**
 * The bigint with the value of `n`, an integral number: what `BigInt(n)`
 * answers on one, `-0` giving `0n`, and exact at every magnitude —
 * `bigint(2 ** 53 + 2)` is `9007199254740994n`, and `bigint(1e308)` the
 * 309-digit integer that double holds. A fraction, `NaN` and the infinities
 * have no bigint: `BigInt` throws a `RangeError` on them, and this throws
 * too. It also throws on a value of another type, which `BigInt` would
 * convert — `BigInt('12')` is `12n`, `BigInt(true)` is `1n` — and this does
 * not: a conversion from a string or a boolean is a change the module
 * being converted makes explicitly.
 *
 * @type {(n: number) => bigint}
 */
export const bigint = n => {
    if (!Number.isInteger(n)) { throw 'not an integral number' }
    return n < 0 ? -bits(-n) : bits(n)
}
