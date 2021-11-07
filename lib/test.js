const lib = require('./index')

require('./iterable/test')

{
    /** @type {lib.Dictionary<number>} */
    const map = lib.dictionary().set('x')(12).set('y')(44)
    lib.panic_if('map.get(\'x\')')(map.get('x') !== 12)
    lib.panic_if('map.get(\'y\')')(map.get('y') !== 44)
    lib.panic_if('map.get(\'a\')')(map.get('a') !== undefined)
    const entries = Array.from(map.entries())
    lib.panic_if('map.entries()')(entries.length !== 2)
}