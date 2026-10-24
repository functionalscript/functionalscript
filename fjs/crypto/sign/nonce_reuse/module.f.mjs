/**
 * A deliberately broken P-256 signer illustrating private-key recovery from
 * two different messages signed with the same nonce. Demo-only fixed values.
 * @module
 */

import { secp256r1 } from '../../secp/module.f.mjs'
import { all } from '../module.f.mjs'
import { computeSync, sha256 } from '../../sha2/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.js'

/** Derive two signatures and recover the key from public scalars alone. */
export const example = () => {
    const { nf: { p: q, div, sub, mul }, mul: pointMul, g } = secp256r1
    const key = 0x1234_5678n
    const k = 7n
    const [rx] = assertNotNullish(pointMul(k)(g))
    const r = rx % q
    const hash = computeSync(sha256)
    const { bits2intModQ } = all(q)
    const messages = ['sample', 'test'].map(message => {
        const h = bits2intModQ(hash([utf8(message)]))
        return { message, h, r, s: div(h + r * key)(k) }
    })
    const [{ h: h1, s: s1 }, { h: h2, s: s2 }] = messages
    // Public inputs only: the recovery expression never reads `key` or `k`.
    const recovered = div(sub(mul(s1)(h2))(mul(s2)(h1)))(mul(r)(sub(s2)(s1)))
    return { q, key, k, messages, recovered }
}
