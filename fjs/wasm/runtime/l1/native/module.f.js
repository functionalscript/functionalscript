/**
 * The native rows of L1 that the bodies in [`..`](../module.f.js) call so
 * far, and `numberRemainder`, the row of their `%` on two numbers, each
 * with a plain JavaScript body
 * ([`l1-design.md`](../../../../../doc/sasha-gil/wasm/l1-design.md#the-operations)).
 * A native row has no FunctionalScript body over the L0 view: the L0 view
 * cannot read a bigint's words, for example, and WASM has no instruction
 * for `%`. Every runtime implements the rows, and the WASM backend lowers
 * each function here to its `fjs:l1-native` import, as it lowers
 * [`../../l0`](../../l0/module.f.js), and `%` to `numberRemainder`. On a
 * JavaScript host the bodies run as they are, so the L1 bodies are proved
 * before any WASM exists.
 *
 * A row joins with its first caller. Like the L0 view, a body checks its
 * preconditions and throws where WASM would trap, with the text
 * `l1.<name>: <reason>`.
 *
 * @module
 */

import { asBigInt, asNumber, asString } from '../../l0/module.f.js'
import { error } from '../error/module.f.js'

/**
 * Whether two bigints are equal, the bigint case of `===`.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const bigintEquals = (a, b) => asBigInt(a) === asBigInt(b)

/**
 * [`Number::remainder`](https://tc39.es/ecma262/#sec-numeric-types-number-remainder),
 * `%` on two numbers, which WASM has no instruction for: the sign is the
 * dividend's, and the answer is `NaN` where the divisor is zero or the
 * dividend is infinite.
 *
 * @type {(a: unknown, b: unknown) => number}
 */
export const numberRemainder = (a, b) => asNumber(a) % asNumber(b)

/**
 * [`Number::toString`](https://tc39.es/ecma262/#sec-numeric-types-number-tostring)
 * in radix 10: the shortest text that reads back as the same number.
 *
 * @type {(n: unknown) => string}
 */
export const numberToString = n => String(asNumber(n))

/**
 * [`StringToNumber`](https://tc39.es/ecma262/#sec-stringtonumber): the
 * number a string's text spells, `NaN` where it spells none.
 *
 * @type {(s: unknown) => number}
 */
export const stringToNumber = s => Number(asString(s))

/**
 * [`BigInt::toString`](https://tc39.es/ecma262/#sec-numeric-types-bigint-tostring)
 * in radix 10.
 *
 * @type {(b: unknown) => string}
 */
export const bigintToString = b => String(asBigInt(b))

/**
 * The bigint operands of an arithmetic row, or a throw where WASM traps.
 *
 * @type {(name: string, a: unknown, b: unknown) => readonly [bigint, bigint]}
 */
const bigints = (name, a, b) => {
    if (typeof a !== 'bigint' || typeof b !== 'bigint') { throw 'l1.' + name + ': not a bigint' }
    return [a, b]
}

/**
 * `+` on two bigints.
 *
 * @type {(a: unknown, b: unknown) => bigint}
 */
export const bigintAdd = (a, b) => {
    const [x, y] = bigints('bigintAdd', a, b)
    return x + y
}

/**
 * `-` on two bigints.
 *
 * @type {(a: unknown, b: unknown) => bigint}
 */
export const bigintSubtract = (a, b) => {
    const [x, y] = bigints('bigintSubtract', a, b)
    return x - y
}

/**
 * `*` on two bigints.
 *
 * @type {(a: unknown, b: unknown) => bigint}
 */
export const bigintMultiply = (a, b) => {
    const [x, y] = bigints('bigintMultiply', a, b)
    return x * y
}

/**
 * `/` on two bigints, truncated toward zero. A zero divisor throws NaNVM's
 * `RangeError`.
 *
 * @type {(a: unknown, b: unknown) => bigint}
 */
export const bigintDivide = (a, b) => {
    const [x, y] = bigints('bigintDivide', a, b)
    if (y === 0n) { throw error.divisionByZero }
    return x / y
}

/**
 * Unary `-` on a bigint.
 *
 * @type {(a: unknown) => bigint}
 */
export const bigintNegate = a => -asBigInt(a)

/**
 * [`IsLessThan`](https://tc39.es/ecma262/#sec-islessthan) of two
 * primitives where at least one is a bigint and each is a bigint, a
 * number or a string, the mixed comparisons: `1` for less, `0` for not
 * less, and `-1` for undefined, which a `NaN` or a string that spells no
 * integer gives.
 *
 * @type {(a: unknown, b: unknown) => number}
 */
export const bigintLess = (a, b) => {
    const ka = typeof a
    const kb = typeof b
    if (ka !== 'bigint' && kb !== 'bigint') { throw 'l1.bigintLess: not a bigint' }
    if (ka !== 'bigint' && ka !== 'number' && ka !== 'string') { throw 'l1.bigintLess: not a numeric' }
    if (kb !== 'bigint' && kb !== 'number' && kb !== 'string') { throw 'l1.bigintLess: not a numeric' }
    const x = /** @type {bigint} */ (a)
    const y = /** @type {bigint} */ (b)
    return x < y ? 1 : x >= y ? 0 : -1
}
