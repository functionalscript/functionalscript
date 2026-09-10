import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { length, msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { hole, latin1 } from '../testlib.f.mjs'
import { toHex, tryFromHex } from './module.f.mjs'

/** @type {(hex: string) => readonly number[]} */
const bytes = hex => {
    const id = tryFromHex(latin1(hex))
    return id === null ? [] : toArray(u8List(msb)(id))
}

export const proof = {
    // A 20-byte id and a 32-byte one, and back to the same text.
    widths: () => {
        assertStructurallySame(bytes('00ff10a5' + '0'.repeat(32)), [0, 0xFF, 0x10, 0xA5, ...Array(16).fill(0)])
        const sha256 = 'ab'.repeat(31) + '01'
        const id = tryFromHex(latin1(sha256))
        assertEq(id !== null && length(id), 256n)
        assertEq(id !== null && String.fromCharCode(...toArray(toHex(id))), sha256)
        const sha1 = '0123456789abcdef'.repeat(2) + 'fedcba98'
        const i = tryFromHex(latin1(sha1))
        assertEq(i !== null && String.fromCharCode(...toArray(toHex(i))), sha1)
    },
    // A capital letter reads as its small one; writing spells the small one.
    capital: () => {
        const id = tryFromHex(latin1('AbCdEf' + '0'.repeat(34)))
        assertEq(id !== null && String.fromCharCode(...toArray(toHex(id))), 'abcdef' + '0'.repeat(34))
    },
    // Each refusal: no digits, an odd count, a byte that is no digit.
    refused: () => {
        assertEq(tryFromHex([]), null)
        assertEq(tryFromHex(latin1('abc')), null)
        assertEq(tryFromHex(latin1('0g')), null)
        assertEq(tryFromHex(latin1('0 ')), null)
        assertEq(tryFromHex([0x30, 0xE9]), null)
    },
    throw: {
        nonByte: () => tryFromHex([0x100, 0x30]),
        hole: () => tryFromHex(hole),
    },
}
