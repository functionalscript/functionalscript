const _ = require('./module.f.cjs')
const library = require('../types/test.f.cjs')
const text = require('../../text/module.f.cjs')
const list = require('../../types/list/module.f.cjs')

const f = () =>
{
    const r = list.join('\n')(text.flat('    ')(_.cpp('My')(library)))
    const e = 
        'namespace My\n' +
        '{\n' +
        '    struct Slice\n' +
        '    {\n' +
        '    };\n' +
        '    struct IMy\n' +
        '    {\n' +
        '    };\n' +
        '}'
    if (r !== e) { throw r }
    return r
}

module.exports = {
    /** @readonly */
    result: f()
}
