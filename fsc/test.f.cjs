const _ = require('./module.f.cjs')

module.exports = {
    a: () => {
        if (_.init(4) !== undefined) { throw "FSC" }
    }
}