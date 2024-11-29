const { unsafeCmp } = require('./module.f.mjs').default

module.exports = () => {
    const result = unsafeCmp(true)(false)
    if (result !== 1) { throw result }
}
