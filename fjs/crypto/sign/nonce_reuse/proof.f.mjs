/** @import { Vec } from '../../../types/bit_vec/types.ts' */

import { reuse } from './module.f.mjs'
import { assert, assertEq, assertNotNullish, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.js'
import { curve, secp256r1 } from '../../secp/module.f.js'
import { verify, computeK, all } from '../module.f.mjs'
import { sha256 } from '../../sha2/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'

const { mul: pointMul, g, nf: { p: q, mul: scalarMul } } = secp256r1
const reuseP256 = reuse(secp256r1)(sha256)
const verifyP256 = verify(secp256r1)(sha256)
const nonceP256 = computeK(all(q))(sha256)
/** @type {readonly [Vec, Vec]} */
const messages = [utf8('sample'), utf8('test')]

export const proof = /** @type {const} */ ({
    recovery: () => {
        for (const key of [1n, 0x1234_5678n, q - 1n]) {
            const nonce = nonceP256(key)
            for (const k of [1n, 7n, q - 1n]) {
                const { q: order, signatures, recovered } = assertOk(reuseP256(key, k, messages))
                const recoveredKey = assertOk(recovered)
                assertEq(recoveredKey, key)
                const [{ r: r1, h: h1, s: s1 }, { r: r2, h: h2, s: s2 }] = signatures
                assertEq(r1, r2)
                assert(h1 !== h2)
                assert(s1 !== s2)
                const publicKey = assertNotNullish(pointMul(recoveredKey)(g))
                const verifyPublicKey = verifyP256(publicKey)
                for (const [i, { h, r, s }] of signatures.entries()) {
                    assert(r > 0n && r < order && s > 0n && s < order)
                    assertEq(scalarMul(s)(k), (h + r * key) % order)
                    assert(verifyPublicKey(messages[i])([r, s]))
                }
            }
            assert(nonce(messages[0]) !== nonce(messages[1]))
        }
    },
    equalMessages: () => {
        const { signatures: [first, second], recovered } = assertOk(reuseP256(1n, 7n, [messages[0], messages[0]]))
        assertStructurallySame(first, second)
        assert(assertError(recovered).includes('denominator is zero'))
    },
    scalarRanges: () => {
        for (const n of [-1n, 0n, q, q + 1n]) {
            assert(assertError(reuseP256(n, 7n, messages)).includes('demo private key'))
            assert(assertError(reuseP256(1n, n, messages)).includes('shared nonce'))
        }
    },
    zeroScalars: () => {
        const zeroR = curve({ p: 7n, c: [1n, 1n], g: [0n, 1n], n: 5n })
        assert(assertError(reuse(zeroR)(sha256)(1n, 1n, messages)).includes('r = 0'))
        const zeroS = curve({ p: 7n, c: [4n, 1n], g: [4n, 3n], n: 5n })
        const sign = reuse(zeroS)(sha256)
        assert(assertError(sign(1n, 2n, [utf8('14'), utf8('0')])).includes('s = 0'))
        assert(assertError(sign(1n, 2n, [utf8('0'), utf8('14')])).includes('s = 0'))
    },
})
