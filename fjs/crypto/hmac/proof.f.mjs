/**
 * @import { Hash, State } from '../sha2/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { uint, vec } from '../../types/bit_vec/module.f.mjs'
import { sha1 } from '../sha1/module.f.mjs'
import { sha256, sha384, sha512 } from '../sha2/module.f.mjs'
import { hmac } from './module.f.mjs'

export const proof = {
    // A hash over a state of its own, not SHA-2's: `hmac` reads a block
    // length and folds blocks, so SHA-1's five words do as well as SHA-2's
    // eight. RFC 2202 test cases 1 and 2 for HMAC-SHA1.
    sha1: () => {
        const r = hmac(sha1)(vec(160n)(BigInt(`0x${'0b'.repeat(20)}`)))(utf8('Hi There'))
        assertEq(uint(r), 0xb617318655057264e28bc0b6fb378c8ef146be00n, r)
        const r2 = hmac(sha1)(utf8('Jefe'))(utf8('what do ya want for nothing?'))
        assertEq(uint(r2), 0xeffcdf6ae5eb2fa2d27416d5f184df9c259a7c79n, r2)
    },
    example: () => {
        const r = hmac(sha256)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        assertEq(r, vec(256n)(0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n))
    },
    sha256: () => {
        const r = hmac(sha256)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        assertEq(uint(r), 0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n, r)
    },
    sha384: () => {
        const k = vec(384n)(0n)
        const m = vec(904n)(
             0x0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010069c7548c21d0dfea6b9a51c9ead4e27c33d3b3f180316e5bcab92c933f0e4dbc9a9083505bc92276aec4be312696ef7bf3bf603f4bbd381196a029f340585312n)
        const r = hmac(sha384)(k)(m)
        assertEq(r, vec(384n)(0x8F858157CE005CD52FD8E8F1A46B55E6CFAE21C8C183D9C2F7504BEDF450609EDD7D3C6171DC0BDD2D2444FAA28F18BAn), uint(r).toString(16))
    },
    sha512: () => {
        const r = hmac(sha512)(utf8('key'))(utf8('The quick brown fox jumps over the lazy dog'))
        assertEq(r, vec(512n)(0xb42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3an))
    },
    // RFC 4231 Test Case 6: key (131 bytes of 0xaa = 1048 bits) exceeds SHA-256 block size (512 bits),
    // so the key is first compressed via the hash function before use.
    longKey: () => {
        const key = vec(1048n)(BigInt('0x' + 'aa'.repeat(131)))
        const r = hmac(sha256)(key)(utf8('Test Using Larger Than Block-Size Key - Hash Key First'))
        assertEq(uint(r), 0x60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54n)
    },
    // The shapes HMAC has no answer for, refused where the hash is given
    // rather than where a message arrives: a block of no bits and a block
    // of fewer than none, which no message is cut into and whose byte
    // count `repeat` would shift towards a zero it never reaches; a block
    // that is no whole number of bytes, which the padding is a byte
    // repeated to; and a digest longer than the block, which a long key is
    // replaced by and then padded to. No hash here is any of them, so each
    // is hand-made.
    throw: {
        emptyBlock: () => hmac(/** @type {Hash<State>} */ ({ ...sha256, blockLength: 0n, blockBytes: 0n, hashLength: 0n })),
        negativeBlock: () => hmac(/** @type {Hash<State>} */ ({ ...sha256, blockLength: -8n, blockBytes: -1n, hashLength: -8n })),
        oddBlock: () => hmac(/** @type {Hash<State>} */ ({ ...sha256, blockLength: 9n, blockBytes: 2n })),
        wideDigest: () => hmac(/** @type {Hash<State>} */ ({ ...sha256, hashLength: 1024n, hashBytes: 128n })),
    },
}
