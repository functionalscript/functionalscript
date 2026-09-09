import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { units, utf16 } from './module.f.mjs'

export const proof = {
    // One symbol per code unit, so an astral character is two and a lone
    // surrogate is one, and the text's length is the input's.
    units: () => {
        assertStructurallySame(units('a😀').map(({ symbol }) => symbol), [0x61, 0xD83D, 0xDE00])
        assertStructurallySame(units('\ud800').map(({ symbol }) => symbol), [0xD800])
        assertStructurallySame(units(''), [])
    },
    // Every leaf carries the one shared record, and it names the alphabet.
    metadata: () => {
        const symbols = units('ab')
        assert(symbols[0].meta === utf16 && symbols[1].meta === utf16)
        assertEq(utf16.id, 'utf16')
    },
}
