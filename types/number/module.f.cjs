const { reduce } = require('../list/module.f.cjs')
const { addition, min: minOp, max: maxOp } = require('../function/operator/module.f.cjs')
const compare = require('../function/compare/module.f.cjs')
const { unsafeCmp } = compare

const sum = reduce(addition)(0)

const min = reduce(minOp)(null)

const max = reduce(maxOp)(null)

/** @type {(a: number) => (b: number) => compare.Sign} */
const cmp = unsafeCmp

module.exports = {
    /** @readonly */
    sum,
    /** @readonly */
    min,
    /** @readonly */
    max,
    /** @readonly */
    cmp,
}