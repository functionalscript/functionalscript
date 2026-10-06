/**
 * @import { Hash, State } from '../sha2/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { uint, vec } from '../../types/bit_vec/module.f.mjs'
import { sha1 } from '../sha1/module.f.mjs'
import { sha256, sha384, sha512 } from '../sha2/module.f.mjs'
import { hmac } from './module.f.mjs'
import { demo, digest } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

export const proof = {
    demo: {
        nul: () => {
            for (const [key, text] of [['a\0b', 'message'], ['key', 'a\0b'], ['\0', '\0']]) {
                const html = htmlToString(demo.view({ algorithm: 'SHA-256', key, text }))
                assert(html.includes('OpenSSL command unavailable:'), html)
                assert(!html.includes('Copy OpenSSL command'), html)
                assert(html.includes(digest('SHA-256', key, text)), html)
            }
        },
        multiline: () => {
            const key = 'key'
            const text = '\nfirst\nsecond\n'
            const expected = '8d7d0f2bace9e820ba863c42c4879149e2468f3a9bfe2eab8a3218e142f6b5c2'
            assertEq(digest('SHA-256', key, text), expected)
            const keyed = unwrap(assertNotNullish(runPure(demo.update(demo.init)({ kind: 'input', name: 'key', value: key }))[0]))
            const state = unwrap(assertNotNullish(runPure(demo.update(keyed)({ kind: 'input', name: 'text', value: text }))[0]))
            assertEq(state.key, key)
            assertEq(state.text, text)
            const html = htmlToString(demo.view(state))
            assert(html.includes('type="text" id="key" name="key" value="key"'), html)
            assert(html.includes('box-sizing: border-box; width: 100%'), html)
            assert(html.includes(`<textarea id="text" name="text" rows="8">${text}</textarea>`), html)
            assert(html.includes(`<pre>${expected}</pre>`), html)
            assert(html.includes(`<pre>printf '%s' '${text}' | openssl dgst -sha256 -hmac '${key}'</pre>`), html)
        },
        // Hex vectors computed independently with Node's crypto.createHmac.
        variants: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const vectors = [
                ['SHA-1', 'de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9'],
                ['SHA-224', '88ff8b54675d39b8f72322e65ff945c52d96379988ada25639747e69'],
                ['SHA-256', 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'],
                ['SHA-384', 'd7f4727e2c0b39ae0f1e40cc96f60242d5b7801841cea6fc592c5d3e1ae50700582a96cf35e1e554995fe4e03381c237'],
                ['SHA-512', 'b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a'],
                ['SHA-512/224', 'a1afb4f708cb63570639195121785ada3dc615989cc3c73f38e306a3'],
                ['SHA-512/256', '7fb65e03577da9151a1016e9c2e514d4d48842857f13927f348588173dca6d89'],
            ]
            return vectors.map(([algorithm, expected]) => {
                assertEq(digest(algorithm, 'key', 'The quick brown fox jumps over the lazy dog'), expected)
                const html = htmlToString(demo.view({ algorithm, key: 'key', text: 'The quick brown fox jumps over the lazy dog' }))
                assert(html.includes(`<pre>${expected}</pre>`), html)
                assert(html.includes(`value="${algorithm}" selected=""`), html)
                assert(html.includes(`HMAC-${algorithm}, hex:`), html)
            })
        },
        inputs: () => {
            assertEq(digest('SHA-256', '', ''), 'b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad')
            assertEq(digest('SHA-256', 'key', '0'), '089c386a9149b5cce5972bfe0f05c8d6e92de22e902457b3a23a69a79f85fa97')
            assertEq(digest('SHA-256', 'ключ 🔑', 'Привіт 🌍'), '0f4a347154f7874403e4d33a65dff5929ed00bc1b99a0b3ec7b04f4ffc008667')
            assertEq(digest('SHA-256', 'κ'.repeat(70), 'message'), '83a8578162021a5abf7399bf510e8cd0724bea0003e0be629ed06bad36420f63')
        },
        update: () => {
            /** @type {(event: DemoEvent) => typeof demo.init} */
            const next = event => unwrap(assertNotNullish(runPure(demo.update(demo.init)(event))[0]))
            assertEq(JSON.stringify(demo.init), JSON.stringify({ algorithm: 'SHA-256', key: '', text: '' }))
            assertEq(JSON.stringify(next({ kind: 'input', name: 'algorithm', value: 'SHA-1' })), JSON.stringify({ ...demo.init, algorithm: 'SHA-1' }))
            assertEq(JSON.stringify(next({ kind: 'input', name: 'key', value: 'key' })), JSON.stringify({ ...demo.init, key: 'key' }))
            assertEq(JSON.stringify(next({ kind: 'input', name: 'text', value: 'message' })), JSON.stringify({ ...demo.init, text: 'message' }))
            assertEq(next({ kind: 'start' }), demo.init)
            assertEq(next({ kind: 'click', name: 'other' }), demo.init)
            assertEq(next({ kind: 'input', name: 'other', value: 'ignored' }), demo.init)
        },
        view: () => {
            const empty = htmlToString(demo.view(demo.init))
            assert(empty.includes('name="algorithm"'), empty)
            assert(empty.includes('name="key"'), empty)
            assert(empty.includes('name="text"'), empty)
            assert(empty.includes("<pre>printf '%s' '' | openssl dgst -sha256 -hmac ''</pre>"), empty)
            assert(empty.includes('aria-label="Copy HMAC"'), empty)
            assert(empty.includes('aria-label="Copy OpenSSL command"'), empty)
            const quoted = htmlToString(demo.view({ algorithm: 'SHA-1', key: "k' $HOME", text: "m' `whoami`" }))
            assert(quoted.includes("<pre>printf '%s' 'm'\\'' `whoami`' | openssl dgst -sha1 -hmac 'k'\\'' $HOME'</pre>"), quoted)
        },
        throw: {
            unknownDigest: () => digest('unknown', '', ''),
            unknownView: () => demo.view({ ...demo.init, algorithm: 'unknown' }),
        },
    },
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
        oddBlock: () => hmac(/** @type {Hash<State>} */ ({ ...sha256, blockLength: 513n, blockBytes: 65n })),
        wideDigest: () => hmac(/** @type {Hash<State>} */ ({ ...sha256, hashLength: 1024n, hashBytes: 128n })),
    },
}
