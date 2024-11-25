const compare = require('../function/compare/module.f.cjs')
const op = require('../function/operator/module.f.cjs')
const { unsafeCmp } = compare
const { reduce } = require('../list/module.f.cjs')

/** @typedef {op.Unary<bigint, bigint>} Unary*/

/** @type {(a: bigint) => (b: bigint) => bigint} */
const addition = a => b => a + b

const sum = reduce(addition)(0n)

/** @type {(a: bigint) => bigint} */
const abs = a => a >= 0 ? a : -a

/** @type {(a: bigint) => compare.Sign} */
const sign = a => unsafeCmp(a)(0n)

/** @type {(a: bigint) => string} */
const serialize = a => `${a}n`

/**
 * @template T
 * @typedef {{
 *  readonly 0: T
 *  readonly add: op.Reduce<T>
 * }} Additive
 */

/** @type {<T>(a: Additive<T>) => (a: T) => (n: bigint) => T} */
const scalar_mul = ({ 0: _0, add }) => a => n => {
    let ai = a
    let ni = n
    let result = _0
    while (true) {
        if ((ni & 1n) === 1n) {
            result = add(result)(ai)
        }
        ni >>= 1n
        if (ni === 0n) {
            return result
        }
        ai = add(ai)(ai)
    }
}

const bitLen = (/** @type {bigint} */v) => {
    if (v < 0n) { v = -v }
    if (v === 0n) { return 0n }
    let result = 1n
    let i = 1n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            break
        }
        v = n
        result += i
        i <<= 1n
    }
    do {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    } while (i !== 0n)
    return result
}

const log2 = (/** @type {bigint} */v) => v <= 0n ? -1n : bitLen(v) - 1n

module.exports = {
    /** @readonly */
    addition,
    /** @readonly */
    sum,
    /** @readonly */
    abs,
    /** @readonly */
    sign,
    /** @readonly */
    serialize,
    /** @readonly */
    scalar_mul,
    /** @readonly */
    log2,
    /** @readonly */
    bitLen,
}
