const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')

/** @type {(name: string) => (library: types.Library) => text.Block} */
const rust = name => library => []

module.exports = {
    /** @readonly */
    rust,
}
