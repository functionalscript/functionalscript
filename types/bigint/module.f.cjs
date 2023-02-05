const { unsafeCmp } = require('../function/compare/module.f.cjs')
const { reduce } = require('../list/module.f.cjs')

/** @type {(a: bigint) => (b: bigint) => bigint} */
const addition = a => b => a + b

const sum = reduce(addition)(0n)

/** @type {(a: bigint) => bigint} */
const abs = a => a >= 0 ? a : -a

/** @type {(a: bigint) => bigint} */
const sign = a => BigInt(unsafeCmp(a)(0n))

module.exports = {
    /** @readonly */
    addition,
    /** @readonly */
    sum,
    /** @readonly */
    abs,
    /** @readonly */
    sign,
}