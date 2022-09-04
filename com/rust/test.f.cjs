const { rust } = require('./module.f.cjs')
const { flat } = require('../../text/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')
const library = require('../types/test.f.cjs')

{
    const r = join('\n')(flat('    ')(rust('My')(library)))
    if (r !== '') { throw r }
}

module.exports = {}