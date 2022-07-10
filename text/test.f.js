const _ = require('./main.f.js')
const list = require('../types/list/main.f.js')

{
    /** @type {_.Block} */
    const text = [
        'a',
        'b',
        [
            'c',
            ['d'],
        ]
    ]
    const result = list.join('\n')(_.flat('_')(text))
    if (result !== 'a\nb\n_c\n__d') { throw result }
}

module.exports = {}
