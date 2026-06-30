import { maxLength, maxLengthBytes, vec } from '../bit_vec/module.f.ts'
import { toVec, fromVec, listToVec, decodeUtf8, encodeUtf8 } from './module.f.ts'
import { unwrap } from '../nullable/module.f.ts'
import { strictEqual } from '../function/operator/module.f.ts'
import { equal, fromArrayLike } from '../list/module.f.ts'

const assertEq = <T>(a: T, b: T) => {
    if (a !== b) { throw [a, b] }
}

const assertArrayEq = (a: Uint8Array, b: Uint8Array) => {
    if (!equal(strictEqual)(fromArrayLike(a))(fromArrayLike(b))) {
        throw [a, b]
    }
}

export const proof = {
    empty: () => {
        const input = new Uint8Array()
        const vec = unwrap(toVec(input))
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    roundTrip: () => {
        const input = Uint8Array.from([0, 1, 2, 3, 255])
        const vec = unwrap(toVec(input))
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    unalignedLength: () => {
        const input = vec(4n)(0xFn)
        const output = fromVec(input)
        assertArrayEq(output, Uint8Array.from([0xF0]))
    },
    encodeUtf8Empty: () => {
        const output = unwrap(encodeUtf8(''))
        assertArrayEq(output, new Uint8Array())
    },
    encodeUtf8Ascii: () => {
        const output = unwrap(encodeUtf8('Hi!'))
        assertArrayEq(output, Uint8Array.from([72, 105, 33]))
    },
    encodeUtf8Multibyte: () => {
        const output = unwrap(encodeUtf8('✓'))
        assertArrayEq(output, Uint8Array.from([0xE2, 0x9C, 0x93]))
    },
    decodeUtf8Ascii: () => {
        const output = unwrap(decodeUtf8(Uint8Array.from([102, 115])))
        assertEq(output, 'fs')
    },
    decodeUtf8Multibyte: () => {
        const output = unwrap(decodeUtf8(Uint8Array.from([0xE2, 0x9C, 0x93])))
        assertEq(output, '✓')
    },
    utf8RoundTrip: () => {
        const input = 'FunctionalScript 🐝'
        const output = unwrap(decodeUtf8(unwrap(encodeUtf8(input))))
        assertEq(output, input)
    },
    listToVec: () => {
        const result = unwrap(listToVec([Uint8Array.from([1, 2]), Uint8Array.from([3])]))
        assertArrayEq(fromVec(result), Uint8Array.from([1, 2, 3]))
    },
    // A `maxLengthBytes`-byte array is the largest a single `Vec` can hold: it
    // converts (non-`null`).
    maxLength: () => {
        if (toVec(new Uint8Array(Number(maxLengthBytes))) === null) {
            throw 'at maxLengthBytes should not be null'
        }
    },
    // One byte past the cap returns `null` rather than throwing — the over-cap
    // signal a boundary turns into a typed error.
    overMaxIsNull: () => {
        if (toVec(new Uint8Array(Number(maxLengthBytes) + 1)) !== null) {
            throw 'one byte past maxLengthBytes should be null'
        }
    },
}
