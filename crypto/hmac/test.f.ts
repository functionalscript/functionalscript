import { utf8 } from '../../text/module.f.ts'
import { unsafeVec, vec } from '../../types/bit_vec/module.f.ts'
import { sha256, sha512 } from '../sha2/module.f.ts'
import { hmac } from './module.f.ts'

export default {
    example: () => {
        const r = hmac(sha256)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        if (r !== vec(256n)(0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n)) { throw r }
    },
    sha256: () => {
        const r = hmac(sha256)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        if (r !== unsafeVec(0x1_f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n)) { throw r }
    },
    sha512: () => {
        const r = hmac(sha512)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        if (r !== unsafeVec(0x1_b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3an)) {
            throw r
        }
    }
}
