const _ = require('./module.f.mjs')

/** @type {_.Library} */
module.exports = {
    Slice: {
        struct: {
            Start: ['*', 'u8'],
            Size: 'usize',
        },
    },
    ManagedStruct: {
        struct: {
            M: ['IMy']
        }
    },
    IMy: {
        guid: 'C66FB270-2D80-49AD-BB6E-88C1F90B805D',
        interface: {
            GetSlice: { _: ['Slice'] },
            SetSlice: { slice: ['Slice'] },
            GetUnsafe: { _: ['*', 'bool'] },
            SetUnsafe: {
                p: ['*', ['Slice']],
                size: 'u32'
            },
            Some: { p: ['IMy'], _: 'bool' },
            GetIMy: { a: 'u16', b: 'i16', _: ['IMy'] },
            SetManagedStruct: { a: ['ManagedStruct'] },
        },
    }
}