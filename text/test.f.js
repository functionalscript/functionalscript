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
        ],
        'e',
    ]
    const result = list.join('\n')(_.flat(':')(text))
    if (result !== 'a\nb\n:c\n::d\ne') { throw result }
}

module.exports = {}
