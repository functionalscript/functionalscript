const lib = require('./index')

/** @type {(_: number) => (_: number) => number} */
const add = a => b => a + b

const r = lib.reduce(add)(0)([120, 300, 42])

if (r !== 462) { lib.panic('reduce') }

module.exports = {}