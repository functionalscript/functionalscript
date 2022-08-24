const { reduce } = require('../list/module.f.cjs')

/** @type {(a: bigint) => (b: bigint) => bigint} */
const addition = a => b => a + b

const sum = reduce(addition)(0n)

module.exports = {
    /** @readonly */
    addition,
    /** @readonly */
    sum,
}