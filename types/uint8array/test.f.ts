import { vec } from '../bit_vec/module.f.ts'
import { toVec, fromVec, decodeUtf8, encodeUtf8 } from './module.f.ts'

const assertEq = <T>(a: T, b: T) => {
    if (a !== b) { throw [a, b] }
}

const assertArrayEq = (a: Uint8Array, b: Uint8Array) => {
    assertEq(a.length, b.length)
    for (let i = 0; i < a.length; i += 1) {
        assertEq(a[i], b[i])
    }
}

export default {
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
    }
}
