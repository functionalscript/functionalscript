/**
 * @import { Oid } from '../types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { empty, length, maxLengthBytes, msb, u8List, vec } from '../../types/bit_vec/module.f.mjs'
import { cycle, take, toArray } from '../../types/list/module.f.mjs'
import { commitPayload, hole, latin1, mergePayload, modesTree, rootTree, sha256Commit, sha256Tree, tagPayload } from '../testlib.f.mjs'
import { of, toHex, tryFromHex, tryFromHexOf } from './module.f.mjs'

/** @type {(hex: string) => readonly number[]} */
const bytes = hex => {
    const id = tryFromHex(latin1(hex))
    return id === null ? [] : toArray(u8List(msb)(id))
}

/** @type {(id: Oid) => string} */
const hex = id => String.fromCharCode(...toArray(toHex(id)))

const of20 = of(20)

const of32 = of(32)

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
    // At a width: the id of that width reads, any other is refused, and
    // what is no hex at all is refused as before.
    ofWidth: () => {
        const sha1 = latin1('ab'.repeat(20))
        const sha256 = latin1('ab'.repeat(32))
        assertEq(tryFromHexOf(20)(sha1) !== null, true)
        assertEq(tryFromHexOf(32)(sha1), null)
        assertEq(tryFromHexOf(32)(sha256) !== null, true)
        assertEq(tryFromHexOf(20)(sha256), null)
        assertEq(tryFromHexOf(20)(latin1('ab'.repeat(19))), null)
        assertEq(tryFromHexOf(20)(latin1('zz'.repeat(20))), null)
    },
    // A capital letter reads as its small one; writing spells the small one.
    capital: () => {
        const id = tryFromHex(latin1('AbCdEf' + '0'.repeat(34)))
        assertEq(id !== null && String.fromCharCode(...toArray(toHex(id))), 'abcdef' + '0'.repeat(34))
    },
    // As many bytes as a `Vec` holds reads; one more is refused, not thrown.
    ceiling: () => {
        const most = Number(maxLengthBytes)
        const id = tryFromHex(latin1('00'.repeat(most - 1) + '01'))
        assertEq(id !== null && length(id), maxLengthBytes * 8n)
        assertEq(tryFromHex(latin1('00'.repeat(most + 1))), null)
    },
    // Each refusal: no digits, an odd count, a byte that is no digit.
    refused: () => {
        assertEq(tryFromHex([]), null)
        assertEq(tryFromHex(latin1('abc')), null)
        assertEq(tryFromHex(latin1('0g')), null)
        assertEq(tryFromHex(latin1('0 ')), null)
        assertEq(tryFromHex([0x30, 0xE9]), null)
    },
    // The checked-in Git objects, each with the id Git computed: SHA-1 at
    // 20 bytes over the five a SHA-1 repository wrote, SHA-256 at 32 over
    // the two a SHA-256 one wrote, and each refused at the other width by
    // the reader, since the hash at the other width is some other id.
    of: {
        commit: () => assertEq(hex(of20('commit', commitPayload)), 'd2bc56a53b2d6d7c1dc0860dec10435ed479b22d'),
        merge: () => assertEq(hex(of20('commit', mergePayload)), '9880b6949363a320bb2a534e6de86d72d2206a14'),
        tag: () => assertEq(hex(of20('tag', tagPayload)), 'b79a8e25df6a75ef83c047b329e730d92ad59dec'),
        rootTree: () => assertEq(hex(of20('tree', rootTree)), 'b007dac9ff840a9f5f9eaa68747d0c91b44c556b'),
        modesTree: () => assertEq(hex(of20('tree', modesTree)), '5c1f5cdc3637a09fa100a2055ed273b7d91f3d80'),
        sha256Commit: () => assertEq(hex(of32('commit', sha256Commit)), '8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f'),
        sha256Tree: () => assertEq(hex(of32('tree', sha256Tree)), '2f1e8b790adef60b1b58a9fe37ff415972da0e5abd333e171a4f999484eb42b0'),
        // The empty blob, the one id every Git user has seen, and a width
        // is a width: the same bytes at the other give the other's id.
        emptyBlob: () => {
            assertEq(hex(of20('blob', [])), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
            assertEq(hex(of32('blob', [])), '473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813')
            assertEq(tryFromHexOf(32)(toHex(of20('blob', []))), null)
        },
        // A payload longer than one chunk, and longer than a `Vec` holds,
        // given as a lazy list that is never an array: the hash sees every
        // byte whatever the pieces.
        long: () => {
            const payload = take(200_000)(cycle(Array.from({ length: 256 }, (_, i) => i)))
            assertEq(hex(of20('blob', payload)), 'aa0916be0c6aa2ad2eb4173843f154cb9ac1ab5a')
        },
    },
    throw: {
        nonByte: () => tryFromHex([0x100, 0x30]),
        hole: () => tryFromHex(hole),
        notAByteInPayload: () => of20('blob', [0x100]),
        // A one-bit `Vec` is no id: spelled, it would pad to `80` and read
        // back as a byte.
        notWholeBytes: () => toHex(vec(1n)(1n)),
        // No bytes is no id either: `tryFromHex` reads no hex of none.
        empty: () => toHex(empty),
    },
}
