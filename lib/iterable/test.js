const i = require('.')
const lib = require('..')

{
    const r = i.sum([120, 300, 42])
    lib.panic_if('reduce')(r !== 462)
}

{
    lib.panic_if('first sum')(i.sum([1, 2]) !== 3)
    lib.panic_if('second sum')(i.sum([1, 2]) !== 3)
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

{
    lib.panic_if('find')(i.find(x => x === 'c')(['a', 'b', 'c']) !== 'c') 
}

{
    /** @type {(_: string) => string|undefined} */
    const file = _ => 'x'
    /** @type {(_: string) => string|undefined} */
    const x = p => lib.pipe
        (i.map(x => file(x())))
        (i.find(x => x !== undefined))
        ([() => p, () => `${p}.js`, () => `${p}/index.js`])
    lib.panic_if('map.find')(x('index.js') !== 'x')
}