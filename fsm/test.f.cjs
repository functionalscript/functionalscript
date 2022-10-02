const _ = require('./module.f.cjs')

module.exports = {
    escape: [
        () => {
            const result = _.escape('abc')
            if (result !== 'abc') { throw result }
        },
        () => {
            const result = _.escape('\\a|b|c\\')
            if (result !== '\\\\a\\|b\\|c\\\\') { throw result }
        }
    ]
}
