const _ = require('.')

{
    const packageJson = { dependencies: {} }
    const dir = _.dependencies(packageJson)
    const r = dir('x')
    if (r !== undefined) { throw r }
}

{
    const packageJson = { dependencies: { 'x': 'e' } }
    const dir = _.dependencies(packageJson)
    const r = dir('x')
    if (r !== 'e') { throw r }
}

{
    const packageJson = { 
        dependencies: { 
            'x/a': 'xa',
            'x/b': 'xb'
        } 
    }
    const dir = _.dependencies(packageJson)
    const x = dir('x')
    if (typeof x !== 'function') { throw x }
    const xa = x('a')
    if (xa !== 'xa') { throw xa }
    const xb = x('b')
    if (xb !== 'xb') { throw xb }
    const xc = x('c')
    if (xc !== undefined) { throw xc }
}