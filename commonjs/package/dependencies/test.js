const _ = require('.')
const pack = require('..')

{
    /** @type {pack.Dependencies} */
    const dependencies = {}
    const dir = _.getDirectory(dependencies)
    const r = dir('x')
    if (r !== undefined) { throw r }
}

{
    const dependencies = { 'x': 'e' }
    const dir = _.getDirectory(dependencies)
    const r = dir('x')
    if (r !== 'e') { throw r }
}

{
    const dependencies = { 
        'x/a': 'xa',
        'x/b': 'xb'
    } 
    const dir = _.getDirectory(dependencies)
    const x = dir('x')
    if (typeof x !== 'function') { throw x }
    const xa = x('a')
    if (xa !== 'xa') { throw xa }
    const xb = x('b')
    if (xb !== 'xb') { throw xb }
    const xc = x('c')
    if (xc !== undefined) { throw xc }
}
