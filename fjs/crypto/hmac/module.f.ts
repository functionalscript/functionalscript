/**
 * Provides an implementation of HMAC (Hash-based Message Authentication Code).
 *
 * https://en.wikipedia.org/wiki/HMAC
 * https://www.rfc-editor.org/rfc/rfc2104
 *
 * @module
 *
 * @example
 *
 * ```ts
 * import { vec } from '../../types/bit_vec/module.f.ts'
 * import { msbUtf8 } from '../../text/module.f.ts'
 * import { sha256 } from '../sha2/module.f.ts'
 *
 * const r = hmac(sha256)(msbUtf8('key'))(msbUtf8('The quick brown fox jumps over the lazy dog'))
 * if (r !== vec(256n)(0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n)) { throw r }
 * ```
 */

import { length, type Vec, msb, vec, vec8, type Reduce, repeat } from '../../types/bit_vec/module.f.ts'
import { computeSync, type Sha2 } from '../sha2/module.f.ts'

const { concat, xor } = msb

/**
 * Outer padding.
 */
const oPad = vec8(0x5cn)

/**
 * Inner padding.
 */
const iPad = vec8(0x36n)

/**
 * Generates an HMAC (Hash-based Message Authentication Code) using the specified hash function.
 *
 * @param hashFunc - The hash function implementation to use.
 * @returns - A function that takes a key and returns another function
 * that takes a message and computes the HMAC.
 */
export const hmac = (hashFunc: Sha2): Reduce => {
    const { blockLength } = hashFunc
    const p = repeat(blockLength >> 3n)
    const ip = p(iPad)
    const op = p(oPad)
    const c = computeSync(hashFunc)
    return k => {
        const k1 = length(k) > blockLength ? c([k]) : k
        const k2 = concat(k1)(vec(blockLength - length(k1))(0n))
        const xk2 = xor(k2)
        const f = (p: Vec) => {
            const x = xk2(p)
            return (msg: Vec) => c([x, msg])
        }
        const fip = f(ip)
        const fop = f(op)
        return m => fop(fip(m))
    }
}
