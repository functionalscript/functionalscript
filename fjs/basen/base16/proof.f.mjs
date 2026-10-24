import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { decode, decodeCodePoints, decodeLower, encode, encodeCodePoints, encodeScalar } from './module.f.mjs'
import { unwrap } from '../../types/nullable/module.f.js'

/** Every byte, in order, for the round trips. */
const all = Array.from({ length: 0x100 }, (_, i) => i)

export const proof = {
    encode: () => {
        assertEq(encode([]), '')
        assertEq(encode([0]), '00')
        assertEq(encode([0x0f, 0x10, 0xa5, 0xff]), '0f10a5ff')
        assertEq(encode(all).length, 0x200)
    },
    encodeCodePoints: () => {
        assertStructurallySame(encodeCodePoints([]), [])
        // `0`, `9`, `a`, `f`: both ends of both digit ranges
        assertStructurallySame(encodeCodePoints([0x09, 0xaf]), [0x30, 0x39, 0x61, 0x66])
    },
    // padded to the width, never cut to it, for a number and a bigint alike
    encodeScalar: () => {
        assertEq(encodeScalar(2)(0), '00')
        assertEq(encodeScalar(4)(0x61), '0061')
        assertEq(encodeScalar(2)(0x1ff), '1ff')
        assertEq(encodeScalar(8)(0xdead_beefn), 'deadbeef')
        assertEq(encodeScalar(0)(0xan), 'a')
    },
    decode: () => {
        assertStructurallySame(decode(''), [])
        assertStructurallySame(decode('0f10a5ff'), [0x0f, 0x10, 0xa5, 0xff])
        // either case, mixed within a byte too
        assertStructurallySame(decode('FF0A'), [0xff, 0x0a])
        assertStructurallySame(decode('aB'), [0xab])
        // an odd count, a digit dropped
        assertEq(decode('abc'), null)
        assertEq(decode('a'), null)
        // a code unit that is no digit, either side of each range
        for (const s of ['/0', '0:', '`0', '0g', '@0', '0G', '0 ', ' 0', '0x']) {
            assertEq(decode(s), null)
        }
        // a code unit above ASCII, and a surrogate pair
        assertEq(decode('٠١'), null)
        assertEq(decode('😀'), null)
    },
    decodeCodePoints: () => {
        assertStructurallySame(decodeCodePoints([0x41, 0x30]), [0xa0])
        // a non-integer is no digit, never the fraction a range test spells
        assertEq(decodeCodePoints([48.5, 0x30]), null)
        assertEq(decodeCodePoints([0x30]), null)
    },
    decodeLower: () => {
        assertStructurallySame(decodeLower(''), [])
        assertStructurallySame(decodeLower('efbb'), [0xef, 0xbb])
        assertEq(decodeLower('EF'), null)
        assertEq(decodeLower('eF'), null)
        assertEq(decodeLower('e'), null)
        assertEq(decodeLower('eg'), null)
    },
    roundTrip: () => {
        assertStructurallySame(decode(encode(all)), all)
        assertStructurallySame(decodeLower(encode(all)), all)
        assertStructurallySame(decodeCodePoints(encodeCodePoints(all)), all)
        assertEq(encode(unwrap(decode('DEADBEEF'))), 'deadbeef')
    },
}
