const { foldT: fold } = require('../list/module.f.cjs')

/** @type {(a: bigint) => (b: bigint) => bigint} */
const addition = a => b => a + b

const sum = fold(addition)(0n)

module.exports = {
    /** @readonly */
    addition,
    /** @readonly */
    sum,
}