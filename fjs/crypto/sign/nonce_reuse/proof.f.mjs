/** @import { Vec } from '../../../types/bit_vec/types.ts' */

import { reuse } from './module.f.mjs'
import { assert, assertEq, assertNotNullish, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.js'
import { curve, secp256r1 } from '../../secp/module.f.mjs'
import { verify, computeK, all } from '../module.f.mjs'
import { sha256 } from '../../sha2/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'

const reuseP256 = reuse(secp256r1)(sha256)
/** @type {readonly [Vec, Vec]} */
const messages = [utf8('sample'), utf8('test')]

export const proof = {
    recovery: () => {
        for (const key of [1n, 0x1234_5678n, secp256r1.nf.p - 1n]) {
            for (const k of [1n, 7n, secp256r1.nf.p - 1n]) {
                const { q, signatures, recovered } = assertOk(reuseP256(key, k, messages))
                const recoveredKey = assertOk(recovered)
                assertEq(recoveredKey, key)
                const [first, second] = signatures
                assertEq(first.r, second.r)
                assert(first.h !== second.h)
                assert(first.s !== second.s)
                const publicKey = assertNotNullish(secp256r1.mul(recoveredKey)(secp256r1.g))
                for (const [i, { h, r, s }] of signatures.entries()) {
                    assert(r > 0n && r < q && s > 0n && s < q)
                    assertEq(secp256r1.nf.mul(s)(k), (h + r * key) % q)
                    assert(verify(secp256r1)(sha256)(publicKey)(messages[i])([r, s]))
                }
                const nonce = computeK(all(q))(sha256)(key)
                assert(nonce(messages[0]) !== nonce(messages[1]))
            }
        }
    },
    equalMessages: () => {
        const { signatures: [first, second], recovered } = assertOk(reuseP256(1n, 7n, [messages[0], messages[0]]))
        assertStructurallySame(first, second)
        assert(assertError(recovered).includes('denominator is zero'))
    },
    scalarRanges: () => {
        for (const n of [-1n, 0n, secp256r1.nf.p, secp256r1.nf.p + 1n]) {
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
}
