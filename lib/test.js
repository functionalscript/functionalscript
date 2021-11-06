const lib = require('./index')

/** @type {(_: number) => (_: number) => number} */
const add = a => b => a + b

const r = lib.reduce(add)(0)([120, 300, 42])

lib.panic_if('reduce')(r !== 462)

{
    const s = lib.reduce(add)(0)
    lib.panic_if('first sum')(s([1, 2]) !== 3)
    lib.panic_if('second sum')(s([1, 2]) !== 3)
}

{
    /** @type {lib.Map<number>} */
    const map = lib.map().set('x')(12).set('y')(44)
    lib.panic_if('map.get(\'x\')')(map.get('x') !== 12)
    lib.panic_if('map.get(\'y\')')(map.get('y') !== 44)
    lib.panic_if('map.get(\'a\')')(map.get('a') !== undefined)
    const entries = Array.from(map.entries())
    lib.panic_if('map.entries()')(entries.length !== 2)
}