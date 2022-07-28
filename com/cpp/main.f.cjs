const types = require('../types/main.f.js')
const text = require('../../text/main.f.js')

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cpp = name => lib => []

module.exports = {
    /** @readonly */
    cpp,
}