const operator = require('../types/function/operator/module.f.cjs')
const { merge } = require('../types/range_map/module.f.cjs')

/** @typedef {string} State */

/** @typedef {(a: number) => State} NextState */

/** @type {NextState} */
const unknownSymbol = a => `unknown symbol ${a}`

/** @type {operator.Reduce<NextState>} */
const union = a => b => {
    if (a === unknownSymbol || a === b) { return b }
    if (b === unknownSymbol) { return a }
    throw [a, b]
}

const m = merge({
    union,
    equal: operator.strictEqual,
})

module.exports = {
}
