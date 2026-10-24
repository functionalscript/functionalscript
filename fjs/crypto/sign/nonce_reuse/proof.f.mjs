import { example } from './module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../../asserts/module.f.js'
import { secp256r1 } from '../../secp/module.f.mjs'
import { verify, computeK, all } from '../module.f.mjs'
import { sha256 } from '../../sha2/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'

export const proof = {
    recovery: () => {
        const { q, key, k, messages, recovered } = example()
        assertEq(recovered, key)
        const [first, second] = messages
        assertEq(first.r, second.r)
        assert(first.h !== second.h)
        assert(first.s !== second.s)
        const publicKey = assertNotNullish(secp256r1.mul(recovered)(secp256r1.g))
        for (const { message, h, r, s } of messages) {
            assert(r > 0n && r < q && s > 0n && s < q)
            assertEq(secp256r1.nf.mul(s)(k), (h + r * key) % q)
            assert(verify(secp256r1)(sha256)(publicKey)(utf8(message))([r, s]))
        }
        const nonce = computeK(all(q))(sha256)(key)
        assert(nonce(utf8(first.message)) !== nonce(utf8(second.message)))
    },
}
