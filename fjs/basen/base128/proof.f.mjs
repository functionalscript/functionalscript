/**
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { empty, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { asBase } from '../../types/nominal/module.f.mjs'
import { encode, decode } from './module.f.mjs'

//

/**
 * @param {bigint} a
 * @param {Vec} b
 */
const test = (a, b) => {
    const encoded = encode(a)
    if (encoded !== b) { throw `encoded: ${asBase(encoded).toString(16)}, expected: ${asBase(b).toString(16)}` }
    const [decoded, rest] = decode(b)
    if (decoded !== a) { throw `decoded: ${decoded.toString(16)}, expected: ${a.toString(16)}` }
    if (rest !== empty) { throw `rest: ${asBase(rest).toString(16)}, expected: ${asBase(empty).toString(16)}` }
}

export const proof = () => {
    test(0n, vec8(0n))
    test(1n, vec8(1n))
    test(0x7Fn, vec8(0x7Fn))
    test(0x80n, vec(16n)(0x8100n))
    test(0x81n, vec(16n)(0x8101n))
    test(0x82n, vec(16n)(0x8102n))
    test(0x3FFFn, vec(16n)(0xFF7Fn))
    test(0x4000n, vec(24n)(0x818000n))
}
