const i = require('.')
const lib = require('..')

/** @type {lib.Reducer<number, number>} */
const sum = {
    merge: a => b => a + b,
    value: 0
}

{
    const r = i.reduce(sum)([120, 300, 42])
    lib.panic_if('reduce')(r !== 462)
}

{
    const s = i.reduce(sum)
    lib.panic_if('first sum')(s([1, 2]) !== 3)
    lib.panic_if('second sum')(s([1, 2]) !== 3)
}

{
    const x = Array.from(i.map(a => a ** 2)([1, 2, 3]))
    lib.panic_if('map')(x.length !== 3)
    lib.panic_if('map[0]')(x[0] !== 1)
    lib.panic_if('map[1]')(x[1] !== 4)
    lib.panic_if('map[2]')(x[2] !== 9)
}

{
    lib.panic_if('join')(i.join('/')([]) !== '')
    lib.panic_if('join')(i.join('/')(['a']) !== 'a')
    lib.panic_if('join')(i.join('/')(['a', 'b']) !== 'a/b')
}