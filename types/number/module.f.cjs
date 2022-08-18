const { fold } = require('../list/module.f.cjs')
const { addition, min: minOp, max: maxOp } = require('../function/operator/module.f.cjs')

const sum = fold(addition)(0)

const min = fold(minOp)(undefined)

const max = fold(maxOp)(undefined)

module.exports = {
    /** @readonly */
    sum,
    /** @readonly */
    min,
    /** @readonly */
    max,
}