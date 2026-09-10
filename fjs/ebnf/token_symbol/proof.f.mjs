import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { parser } from '../ll1/module.f.mjs'
import { encoding, start } from './module.f.mjs'

const names = /** @type {const} */ (['>>', '>>>=', 'instanceof'])

export const proof = {
    encode: () => {
        const { encode } = encoding(names)
        assertEq(encode('>>'), 0x110000)
        assertEq(encode('instanceof'), 0x110002)
        assertEq(start, 0x10FFFF + 1)
    },
    decode: [
        () => {
            const { decode } = encoding(names)
            assertEq(decode(0x110000), '>>')
            assertEq(decode(0x110002), 'instanceof')
        },
        () => {
            const { decode } = encoding(names)
            // past the end of the alphabet, a code point, the end of input
            assertEq(decode(0x110003), null)
            assertEq(decode(0x10FFFF), null)
            assertEq(decode(-1), null)
        },
    ],
    roundTrip: () => {
        const { encode, decode } = encoding(names)
        for (const name of names) {
            assertEq(decode(encode(name)), name)
        }
    },
    // A symbol is a rule of one symbol: the value a tokenizer emits is the
    // terminal a grammar over the tokens names it by, and the backend reads
    // the one from the other with nothing between.
    rule: () => {
        const { encode } = encoding(names)
        const tok = /** @type {const} */ ({ id: 'tok' })
        const symbols = names.map(name => ({ symbol: encode(name), meta: tok }))
        assertStructurallySame(parser([encode('>>'), encode('>>>=')])(symbols), ['ok', [[symbols[0], symbols[1]], 2]])
        assertStructurallySame(parser(encode('instanceof'))(symbols), ['error', 0])
    },
    throw: {
        duplicateName: () => { encoding(['a', 'b', 'a']) },
        unregisteredName: () => {
            /** @type {readonly string[]} */
            const names = ['a']
            encoding(names).encode('b')
        },
    },
}
