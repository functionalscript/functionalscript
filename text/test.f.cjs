const _ = require('./module.f.cjs')
const { join } = require('../types/string/module.f.cjs')

module.exports = () => {
    /** @type {_.Block} */
    const text = [
        'a',
        'b',
        () => [
            'c',
            () => ['d'],
        ],
        'e',
    ]
    const result = join('\n')(_.flat(':')(text))
    if (result !== 'a\nb\n:c\n::d\ne') { throw result }
}
