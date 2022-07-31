const _ = require('./module.f.cjs')

{
    const a = {}
    const value = _.at('constructor')(a)
    if (value !== undefined) { throw value }
}

{
    const a = { constructor: 42}
    const value = _.at('constructor')(a)
    if (value !== 42) { throw value }
}