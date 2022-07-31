const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cpp = name => lib => []

module.exports = {
    /** @readonly */
    cpp,
}