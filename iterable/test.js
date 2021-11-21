const i = require('.')
const lib = require('../lib')

{
    const r = i.sum([120, 300, 42])
    if (r !== 462) { throw 'error' }
}

{
    if (i.sum([1, 2]) !== 3) { throw 'error' }
    if (i.sum([1, 2]) !== 3) { throw 'error' }
}

{
    const x = Array.from(i.map(a => a ** 2)([1, 2, 3]))
    if (x.length !== 3) { throw 'error' }
    if (x[0] !== 1) { throw 'error' }
    if (x[1] !== 4) { throw 'error' }
    if (x[2] !== 9) { throw 'error' }
}

{
    if (i.join('/')([]) !== '') { throw 'error' }
    if (i.join('/')(['a']) !== 'a') { throw 'error' }
    if (i.join('/')(['a', 'b']) !== 'a/b') { throw 'error'}
}

{
    if (i.find(x => x === 'c')(['a', 'b', 'c']) !== 'c') { throw 'error' }
}

{
    /** @type {(_: string) => string|undefined} */
    const file = _ => 'x'
    /** @type {(_: string) => string|undefined} */
    const x = p => lib.pipe
        (i.map(x => file(x())))
        (i.find(x => x !== undefined))
        ([() => p, () => `${p}.js`, () => `${p}/index.js`])
    if (x('index.js') !== 'x') { throw 'error' }
}