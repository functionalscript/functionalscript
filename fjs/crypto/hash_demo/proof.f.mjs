import { digestOf, hashOutput } from './module.f.mjs'
import { sha1 } from '../sha1/module.f.mjs'
import { sha256 } from '../sha2/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

const sha1Output = hashOutput({ name: 'SHA-1', hash: sha1, openssl: 'sha1' })
const sha256Output = hashOutput({ name: 'SHA-256', hash: sha256, openssl: 'sha256' })

export const proof = {
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
