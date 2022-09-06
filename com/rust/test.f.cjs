const { rust } = require('./module.f.cjs')
const { flat } = require('../../text/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')
const library = require('../types/test.f.cjs')

{
    const e =
        '#[repr(C)]\n' +
        'pub struct Slice {\n' +
        '}\n' +
        '#[repr(C)]\n' +
        'pub struct IMy {\n' +
        '}'
    const r = join('\n')(flat('    ')(rust('My')(library)))
    if (r !== e) { throw [e, r] }
}

module.exports = {}