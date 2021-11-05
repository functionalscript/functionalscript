const lib = require('./index')

/** @type {(_: number) => (_: number) => number} */
const add = a => b => a + b

const r = lib.reduce(add)(0)([120, 300, 42])

lib.panic_if('reduce')(r !== 462)
