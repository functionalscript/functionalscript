import { assertEq } from '../../asserts/module.f.js'
import { empty, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { encode as base64 } from '../base64/module.f.mjs'
import { encode } from './module.f.mjs'

export const proof = {
    empty: () => assertEq(encode(empty), ''),
    // One, two and three bytes: the last symbol carries zero padding bits,
    // and no `=` follows it.
    unpadded: [
        () => assertEq(encode(vec8(0xffn)), '_w'),
        () => assertEq(encode(vec(16n)(0xffffn)), '__8'),
        () => assertEq(encode(vec(24n)(0xfbefben)), '----'),
    ],
    // Base64 with its two symbols swapped and its padding dropped.
    base64Alphabet: () => {
        const bytes = vec(32n)(0xfbff_bf00n)
        assertEq(base64(bytes), '+/+/AA==')
        assertEq(encode(bytes), '-_-_AA')
    },
    // A bit run that is not whole bytes has no spelling.
    partialByte: () => assertEq(encode(vec(4n)(0xfn)), null),
}
