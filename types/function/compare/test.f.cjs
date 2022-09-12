const { unsafeCmp } = require('./module.f.cjs')

module.exports = () => {
    const result = unsafeCmp(true)(false)
    if (result !== 1) { throw result }
}
