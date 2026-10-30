import { assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { emptyModule, everything, header } from '../../testlib.f.js'
import { parse } from '../parse/module.f.mjs'
import { write } from './module.f.mjs'

export const proof = {
    empty: () => {
        assertStructurallySame(write(emptyModule), header)
    },
    // Written twice, the same bytes: the writer depends on the module alone.
    deterministic: () => {
        const bytes = write(everything)
        assertStructurallySame(write(assertOk(parse(bytes))), bytes)
    },
    // Each integer in its shortest LEB128, whatever its sign.
    shortest: () => {
        const code = write({
            ...emptyModule,
            types: [{ params: [], results: [] }],
            functions: [{
                type: 0,
                locals: [],
                body: [['i32.const', 63], ['i32.const', 64], ['i32.const', -64], ['i32.const', -65], ['call', 0x80]],
            }],
        })
        // The module ends with the one body: its size, no locals, then the code.
        assertStructurallySame(code.slice(-16), [
            15, 0,
            0x41, 0x3f, 0x41, 0xc0, 0x00, 0x41, 0x40, 0x41, 0xbf, 0x7f, 0x10, 0x80, 0x01, 0x0b,
        ])
    },
    // A custom section stays where it was, even after a section left out.
    customPlace: () => {
        const bytes = write({ ...emptyModule, customs: [{ after: 'import', content: ['raw', 'x', [7]] }] })
        assertStructurallySame(bytes, [...header, 0, 3, 1, 0x78, 7])
    },
}
