const { reduce: fold } = require('../list/module.f.cjs')
const { addition, min: minOp, max: maxOp } = require('../function/operator/module.f.cjs')
const compare = require('../function/compare/module.f.cjs')
const { unsafeCmp } = compare

const sum = fold(addition)(0)

const min = fold(minOp)(undefined)

const max = fold(maxOp)(undefined)

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