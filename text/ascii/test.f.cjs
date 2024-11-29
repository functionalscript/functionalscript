const { range } = require('./module.f.mjs').default
const json = require('../../json/module.f.mjs').default
const { sort } = require('../../types/object/module.f.cjs')

const stringify = json.stringify(sort)

module.exports = {
    range: () => {
        const r = stringify(range("A"))
        if (r !== '[65,65]') { throw r }
    }
}