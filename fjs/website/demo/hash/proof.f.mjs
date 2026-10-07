import { digestOf, hashOutput, hexOf, hashAlgorithms, algorithmOf, algorithmOption, opensslVerification } from './module.f.mjs'
import { vec } from '../../../types/bit_vec/module.f.mjs'
import { sha1 } from '../../../crypto/sha1/module.f.mjs'
import { sha256 } from '../../../crypto/sha2/module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

const sha1Output = hashOutput({ name: 'SHA-1', hash: sha1, openssl: 'sha1' })
const sha256Output = hashOutput({ name: 'SHA-256', hash: sha256, openssl: 'sha256' })

export const proof = {
    hex: () => {
        assertEq(hexOf(sha1)(vec(160n)(1n)), '0000000000000000000000000000000000000001')
        assertEq(hexOf(sha256)(vec(256n)(0n)), '0'.repeat(64))
    },
    algorithms: () => {
        const list = hashAlgorithms(({ name, openssl }) => ({ name, openssl }))
        assertEq(JSON.stringify(list), JSON.stringify([
            { name: 'SHA-1', openssl: 'sha1' },
            { name: 'SHA-224', openssl: 'sha224' },
            { name: 'SHA-256', openssl: 'sha256' },
            { name: 'SHA-384', openssl: 'sha384' },
            { name: 'SHA-512', openssl: 'sha512' },
            { name: 'SHA-512/224', openssl: 'sha512-224' },
            { name: 'SHA-512/256', openssl: 'sha512-256' },
        ]))
        const picked = algorithmOf(list)('SHA-256')
        assertEq(picked.openssl, 'sha256')
        assertEq(htmlToString(algorithmOption(picked, picked)), '<!DOCTYPE html><option value="SHA-256" selected="">SHA-256</option>')
        assertEq(htmlToString(algorithmOption(picked, { name: 'SHA-1' })), '<!DOCTYPE html><option value="SHA-256">SHA-256</option>')
    },
    verification: () => {
        const h = htmlToString(['div', ...opensslVerification(['message', 'key'], ([text, key]) => `printf '%s' ${text} | openssl dgst -sha256 -hmac ${key}`)])
        assert(h.includes("<pre>printf '%s' 'message' | openssl dgst -sha256 -hmac 'key'</pre>"), h)
        const refused = htmlToString(['div', ...opensslVerification(['a\0b', 'key'], () => { throw 'must not build a command for NUL' })])
        assert(refused.includes('OpenSSL command unavailable:'), refused)
        assert(!refused.includes('Copy OpenSSL command'), refused)
    },
    throw: {
        unknownAlgorithm: () => algorithmOf([{ name: 'SHA-256' }])('unknown'),
    },
    // Independent literal vectors keep padding, multiline and NUL handling honest.
    digest: () => {
        assertEq(digestOf(sha1)('9'), '0ade7c2cf97f75d009975f4d720d1fa6c19f4897')
        assertEq(digestOf(sha1)('a\nb'), 'fcd127ffa1016069006ad91f3f361248f9bdf272')
        assertEq(digestOf(sha1)('a\0b'), '4a3dec2d1f8245280855c42db0ee4239f917fdb8')
        assertEq(digestOf(sha256)('1234'), '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
    },
    output: () => {
        const h = htmlToString(['div', ...sha1Output("a'b\n$HOME `whoami`")])
        assert(h.includes('SHA-1, hex:'), h)
        assert(h.includes("<pre>printf '%s' 'a'\\''b\n$HOME `whoami`' | openssl dgst -sha1</pre>"), h)
        assert(h.includes('aria-label="Copy digest"'), h)
        assert(h.includes('aria-label="Copy OpenSSL command"'), h)
        const empty = htmlToString(['div', ...sha256Output('')])
        assert(empty.includes("<pre>printf '%s' '' | openssl dgst -sha256</pre>"), empty)
    },
    nul: () => {
        const h = htmlToString(['div', ...sha256Output('a\0b')])
        assert(h.includes('59b271ae1bbcb1d31d41929817f4b16fb439eb4f31520b5ad1d5ce98920a7138'), h)
        assert(h.includes('OpenSSL command unavailable:'), h)
        assert(h.includes('NUL (U+0000)'), h)
        assert(!h.includes('Copy OpenSSL command'), h)
    },
}
