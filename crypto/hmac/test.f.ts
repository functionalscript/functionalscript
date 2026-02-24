import { utf8 } from '../../text/module.f.ts'
import { uint, vec, type Vec } from '../../types/bit_vec/module.f.ts'
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
        const k = vec(384n)(0n)
        const m = vec(904n)(
             0x0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010069c7548c21d0dfea6b9a51c9ead4e27c33d3b3f180316e5bcab92c933f0e4dbc9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312n)
        const r = hmac(sha384)(k)(m)
        if (r !== vec(384n)(0x8F858157CE005CD52FD8E8F1A46B55E6CFAE21C8C183D9C2F7504BEDF450609EDD7D3C6171DC0BDD2D2444FAA28F18BAn)) {
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
