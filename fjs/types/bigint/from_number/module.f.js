/**
 * The bigint of an integral number: `BigInt(n)` on a number, written with
 * the language's own operators, so a module can import it where the `BigInt`
 * global is not admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

import { isInteger } from '../../number/is_integer/module.f.js'

/**
 * The bigint of a non-negative integral number, bit by bit: the lowest bit
 * is `n % 2`, and the bits above it are those of `(n - n % 2) / 2`, both
 * exact on an integral double, since halving one drops no bit. One level
 * of recursion per bit, at most 1024 for the largest double.
 *
 * @type {(n: number) => bigint}
 */
const bits = n => n === 0 ? 0n : bits((n - n % 2) / 2) << 1n | (n % 2 === 0 ? 0n : 1n)

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
    if (!isInteger(n)) { throw 'not an integral number' }
    return n < 0 ? -bits(-n) : bits(n)
}
