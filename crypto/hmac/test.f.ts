import { utf8 } from '../../text/module.f.ts'
import { length, uint, vec, type Vec } from '../../types/bit_vec/module.f.ts'
import { sha256, sha384, sha512 } from '../sha2/module.f.ts'
import { hmac } from './module.f.ts'

export default {
    example: () => {
        const r = hmac(sha256)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        if (r !== vec(256n)(0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n)) { throw r }
    },
    sha256: () => {
        const r = hmac(sha256)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        if (uint(r) !== 0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n) { throw r }
    },

    sha384: () => {

        const k0 = vec(384n)(0n)
        //const v = vec(384n)(0x010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101n)
        //const v1 = vec(8n)(0x01n)
        //const x = vec(512n)(0x69c7548c21d0dfea6b9a51c9ead4e27c33d3b3f180316e5bcab92c933f0e4dbc9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312n)
        const m0 = vec(904n)(
             0x0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010069c7548c21d0dfea6b9a51c9ead4e27c33d3b3f180316e5bcab92c933f0e4dbc9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312n)
        const k =
            -0x800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n as any as Vec
        const m =
            -0x8101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010069c7548c21d0dfea6b9a51c9ead4e27c33d3b3f180316e5bcab92c933f0e4dbc9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312n as
            any as Vec
        if (k !== k0) { throw [k, k0] }
        if (m !== m0) { throw [m, m0] }
        const r = hmac(sha384)(k)(m)
        if (r !== vec(384n)(0x9fd1afe82743d433f901f78b91de8aa2fd12a27ef55c2dccb805add1f58374a04cea7a85a04e7b29a948afa376e45371n)) {
            throw uint(r).toString(16)
        }
    },
    sha512: () => {
        const r = hmac(sha512)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        if (r !== vec(512n)(0xb42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3an)) {
            throw r
        }
    }
}
