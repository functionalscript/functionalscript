const _ = require('./module.f.cjs')

module.exports = {
    ctor: () => {
        const a = {}
        const value = _.at('constructor')(a)
        if (value !== null) { throw value }
    },
    property: () => {
        const a = { constructor: 42 }
        const value = _.at('constructor')(a)
        if (value !== 42) { throw value }
    }
}