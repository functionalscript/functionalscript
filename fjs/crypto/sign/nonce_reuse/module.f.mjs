/**
 * A deliberately broken signer illustrating private-key recovery from two
 * messages signed with one shared nonce. For demo-only keys and nonces.
 * @module
 * @import { Curve } from '../../secp/types.ts'
 * @import { Sha2 } from '../../sha2/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { ReusedNonce } from './types.ts'
 */

import { all } from '../module.f.mjs'
import { computeSync } from '../../sha2/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'

/** Sign twice with one nonce, then eliminate it using only public scalars.
 * Equal hashes still produce signatures, but cannot determine a private key.
 * @type {(curve: Curve) => (hash: Sha2) => (key: bigint, k: bigint, messages: readonly [Vec, Vec]) => Result<ReusedNonce, string>}
 */
export const reuse = curve => hf => {
    const { nf: { p: q, div, sub, mul }, mul: pointMul, g } = curve
    const hash = computeSync(hf)
    const { bits2intModQ } = all(q)
    return (key, k, messages) => {
        if (key <= 0n || key >= q) { return error('The demo private key must be at least 1 and less than the curve order q.') }
        if (k <= 0n || k >= q) { return error('The shared nonce must be at least 1 and less than the curve order q.') }
        const [rx] = assertNotNullish(pointMul(k)(g))
        const r = rx % q
        if (r === 0n) { return error('This nonce produces r = 0. Choose another shared nonce.') }
        const [h1, h2] = messages.map(message => bits2intModQ(hash([message])))
        const s1 = div(h1 + r * key)(k)
        const s2 = div(h2 + r * key)(k)
        if (s1 === 0n || s2 === 0n) { return error('A signature has s = 0. Change the shared nonce, demo key, or message.') }
        // Public inputs only: the recovery expression never reads `key` or `k`.
        const recovered = h1 === h2
            ? error('Both messages have the same hash modulo q, so s1 = s2 and the recovery denominator is zero. Enter two different messages.')
            : ok(div(sub(mul(s1)(h2))(mul(s2)(h1)))(mul(r)(sub(s2)(s1))))
        return ok({ q, key, k, signatures: [{ h: h1, r, s: s1 }, { h: h2, r, s: s2 }], recovered })
    }
}
