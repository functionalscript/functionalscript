const T = require('./module.f.mjs')
const _ = T.default
const { join } = require('../types/string/module.f.cjs')

module.exports = () => {
    /** @type {T.Block} */
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
