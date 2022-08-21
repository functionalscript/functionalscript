const { unsafeCmp } = require('./module.f.cjs')

{
    const result = unsafeCmp(true)(false)
    if (result !== 1) { throw result }
}

module.exports = {}
