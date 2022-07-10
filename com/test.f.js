const _ = require('./index.f.js')

/** @type {_.Library} */
const library = {
    Slice: {
        struct: [
            ['Start', { '*': 'u8' }],
            ['End', 'usize'],
        ]
    },
    IMy: {
        guid: 'C66FB270-2D80-49AD-BB6E-88C1F90B805D',
        interface: [
            ['GetSlice', [], ['Slice']],
            ['SetSlice',
                [['slice', ['Slice']]],
                ''
            ],
        ],
    }
}

module.exports = {}
