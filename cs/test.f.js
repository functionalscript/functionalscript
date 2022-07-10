const _ = require('./main.f.js')

/** @type {_.DefinitionArray} */
const cs = {
    Slice: {
        attributes: 'StructuralLayout(LayoutKind.Sequential)',
        struct: [
            ['Start', {'*': 'byte'}],
            ['Size', 'UIntPtr'],
        ],
    }
}

module.exports = {}
