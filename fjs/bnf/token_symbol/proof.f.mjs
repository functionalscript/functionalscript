import { assertEq } from '../../asserts/module.f.mjs'
import { capacity, encoding } from './module.f.mjs'

const names = /** @type {const} */ (['>>', '>>>=', 'instanceof'])

export const proof = {
    encode: () => {
        const { encode } = encoding(names)
        assertEq(encode('>>'), 0x110000)
        assertEq(encode('instanceof'), 0x110002)
    },
    decode: [
        () => {
            const { decode } = encoding(names)
            assertEq(decode(0x110000), '>>')
            assertEq(decode(0x110002), 'instanceof')
        },
        () => {
            const { decode } = encoding(names)
            // past the end of the alphabet, a code point, and `eof`
            assertEq(decode(0x110003), null)
            assertEq(decode(0x10FFFF), null)
            assertEq(decode(0xFFFFFF), null)
        },
    ],
    roundTrip: () => {
        const { encode, decode } = encoding(names)
        for (const name of names) {
            assertEq(decode(encode(name)), name)
        }
    },
    throw: {
        duplicateName: () => { encoding(['a', 'b', 'a']) },
        unregisteredName: () => { encoding(/** @type {readonly string[]} */ (['a'])).encode('b') },
        // `capacity` names fit, so one more is the smallest list that doesn't.
        // The array is sparse, so this costs a length, not the strings.
        tooManyNames: () => { encoding(new Array(capacity + 1)) },
    },
}
