import { maxLengthBytes, vec } from '../bit_vec/module.f.mjs'
import { toVec, fromVec, listToVec, decodeUtf8, encodeUtf8 } from './module.f.mjs'
import { strictEqual } from '../function/operator/module.f.mjs'
import { equal, fromArrayLike } from '../list/module.f.mjs'
import { assert } from '../../asserts/module.f.mjs'

/**
 * @template T
 * @param {T} a
 * @param {T} b
 */
const assertEq = (a, b) => {
    assert(a === b, [a, b])
}

/** @type {(a: Uint8Array, b: Uint8Array) => void} */
const assertArrayEq = (a, b) => {
    assert(equal(strictEqual)(fromArrayLike(a))(fromArrayLike(b)), [a, b])
}

export const proof = {
    empty: () => {
        const input = new Uint8Array()
        const vec = toVec(input)
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    roundTrip: () => {
        const input = Uint8Array.from([0, 1, 2, 3, 255])
        const vec = toVec(input)
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    unalignedLength: () => {
        const input = vec(4n)(0xFn)
        const output = fromVec(input)
        assertArrayEq(output, Uint8Array.from([0xF0]))
    },
    encodeUtf8Empty: () => {
        const output = encodeUtf8('')
        assertArrayEq(output, new Uint8Array())
    },
    encodeUtf8Ascii: () => {
        const output = encodeUtf8('Hi!')
        assertArrayEq(output, Uint8Array.from([72, 105, 33]))
    },
    encodeUtf8Multibyte: () => {
        const output = encodeUtf8('✓')
        assertArrayEq(output, Uint8Array.from([0xE2, 0x9C, 0x93]))
    },
    decodeUtf8Ascii: () => {
        const output = decodeUtf8(Uint8Array.from([102, 115]))
        assertEq(output, 'fs')
    },
    decodeUtf8Multibyte: () => {
        const output = decodeUtf8(Uint8Array.from([0xE2, 0x9C, 0x93]))
        assertEq(output, '✓')
    },
    utf8RoundTrip: () => {
        const input = 'FunctionalScript 🐝'
        const output = decodeUtf8(encodeUtf8(input))
        assertEq(output, input)
    },
    listToVec: () => {
        const result = listToVec([Uint8Array.from([1, 2]), Uint8Array.from([3])])
        assertArrayEq(fromVec(result), Uint8Array.from([1, 2, 3]))
    },
    maxLength: () => toVec(new Uint8Array(Number(maxLengthBytes))),
    throw: {
        toVec: () => toVec(new Uint8Array(Number(maxLengthBytes) + 1)),
        listToVec: () => listToVec([new Uint8Array(Number(maxLengthBytes)), Uint8Array.from([0])]),
    },
}
