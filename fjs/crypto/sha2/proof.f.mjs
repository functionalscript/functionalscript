/**
 * @import { DemoEvent } from '../../website/demo/types.ts'
 * @import { Hash, Sha2 } from './types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { utf8 } from '../../text/module.f.mjs'
import { bytesIn, maxLengthBytes, repeat, u8ListToVecMsb, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { flip } from '../../types/function/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { map } from '../../types/list/module.f.mjs'
import { base32, base64, ch, computeSync, framed, fromWords, maj, sha224, sha256, sha384, sha512, sha512x224, sha512x256 } from './module.f.mjs'
import { demo, digest } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'

/**
 * Every SHA-2 length is a whole number of bytes, so the rounded-up byte count
 * and the exact division agree — this pins both that identity and the values.
 *
 * @type {(sha2: Sha2) => (hashBytes: bigint, blockBytes: bigint) => void}
 */
const checkBytes = ({ hashLength, blockLength, hashBytes, blockBytes }) => (h, b) => {
    assertEq(hashBytes, h)
    assertEq(blockBytes, b)
    assertEq(hashBytes, bytesIn(hashLength))
    assertEq(blockBytes, bytesIn(blockLength))
}

/**
 * A message whose every byte differs from its neighbours, long enough to
 * fill three blocks of whatever hash reads it.
 *
 * @type {(bytes: number) => readonly number[]}
 */
const varied = bytes => Array.from({ length: bytes * 3 }, (_, i) => (i * 37 + 11) & 0xFF)

/**
 * The digest of a message split in two is the digest of the message,
 * wherever the split falls: before the first block is full, at its edge,
 * and past it. A split before an edge leaves a remainder the next piece
 * completes the block from, which is the one place the framing assembles a
 * block out of two halves — and only a message that differs across the
 * seam can tell the halves apart, so this is what pins the order they go
 * in. Every other proof reaching that line repeats one byte, where the two
 * halves are the same bytes either way round.
 *
 * @template S
 * @param {Hash<S>} h
 * @returns {void}
 */
const seam = h => {
    const bytes = Number(h.blockBytes)
    const msg = varied(bytes)
    const whole = uint(computeSync(h)([u8ListToVecMsb(msg)]))
    for (const at of [1, bytes >> 1, bytes - 1, bytes, bytes + 1, bytes * 2 - 1]) {
        assertEq(uint(computeSync(h)([u8ListToVecMsb(msg.slice(0, at)), u8ListToVecMsb(msg.slice(at))])), whole, at)
    }
}

/**
 * A remainder held, then a `Vec` as long as a `Vec` may be: appending the
 * two gives what computing over the two gives, so the framing never joins
 * them into one `Vec`, which would be over the ceiling every host honours.
 * The two pieces are parameters so the check is closed over nothing.
 *
 * Only that. The order the pieces come in is not free — a message is the
 * pieces in the order they arrive, which is what {@link seam} pins — and
 * swapping them here would agree only because both pieces of the one
 * caller repeat a byte.
 *
 * @template S
 * @param {Vec} held
 * @param {Vec} full
 * @returns {(h: Hash<S>) => void}
 */
const heldThenFull = (held, full) => h => {
    const compute = computeSync(h)
    assertEq(uint(h.end(h.append(full)(h.append(held)(h.init)))), uint(compute([held, full])))
}

/** @type {(sha2: Sha2) => (x: bigint) => void} */
const checkEmpty = ({ init, end, hashLength }) => x => {
    const result = end(init)
    assertEq(result, vec(hashLength)(x), [result, x])
}

// https://en.wikipedia.org/wiki/SHA-2#Test_vectors
//
// https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Secure-Hashing
export const proof = {
    base: {
        b32: () => {
            const { fromV8, compress, chunkLength } = base32
            const e = 1n << (chunkLength - 1n)
            return {
                s256: () => {
                    const result = fromV8(compress(sha256.init.hash)(e))
                    const x = 0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855n
                    assertEq(result, x, [result.toString(16), x.toString(16)])
                },
                s224: () => {
                    const result = fromV8(compress(sha224.init.hash)(e)) >> 32n
                    const x = 0xd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42fn
                    assertEq(result, x, [result, x])
                },
            }
        },
        b64: () => {
            const { fromV8, compress, chunkLength } = base64
            const e = 1n << (chunkLength - 1n)
            return {
                s512: () => {
                    const result = fromV8(compress(sha512.init.hash)(e))
                    const x = 0xcf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3en
                    assertEq(result, x, [result, x])
                },
                s384: () => {
                    const result = fromV8(compress(sha384.init.hash)(e)) >> 128n
                    const x = 0x38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95bn
                    assertEq(result, x, [result, x])
                },
                s512x256: () => {
                    const result = fromV8(base64.compress(sha512x256.init.hash)(e)) >> 256n
                    const x = 0xc672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967an
                    assertEq(result, x, [result, x])
                },
                s512x224: () => {
                    const result = fromV8(compress(sha512x224.init.hash)(e)) >> 288n
                    const x = 0x6ed0dd02806fa89e25de060c19d3ac86cabb87d6a0ddd05c333b84f4n
                    assertEq(result, x, [result, x])
                },
            }
        }
    },
    // Each bit of the answer is a function of the three bits in its place,
    // so eight bits holding all eight combinations pin the whole function.
    ch: () => assertEq(ch(0b11110000n, 0b11001100n, 0b10101010n), 0b11001010n),
    maj: () => assertEq(maj(0b11110000n, 0b11001100n, 0b10101010n), 0b11101000n),
    fromWords: {
        empty: () => assertEq(fromWords(32n)([]), 0n),
        bytes: () => assertEq(fromWords(8n)([0xabn, 0xcdn, 0x00n, 0xffn]), 0xabcd00ffn),
        // SHA-1's initial hash value, five words, as one number.
        v5: () => assertEq(
            fromWords(32n)([0x67452301n, 0xefcdab89n, 0x98badcfen, 0x10325476n, 0xc3d2e1f0n]),
            0x67452301efcdab8998badcfe10325476c3d2e1f0n),
        // The same field with one owner behind it: `base32.fromV8` is
        // `fromWords(32n)` over eight words.
        v8: () => {
            const { hash } = sha256.init
            assertEq(fromWords(32n)(hash), base32.fromV8(hash))
        },
        throw: {
            zeroWidth: () => { fromWords(0n) },
            negativeWidth: () => { fromWords(-8n) },
            wideWord: () => { fromWords(8n)([0x100n, 0n]) },
            negativeWord: () => { fromWords(8n)([-1n]) },
        },
    },
    framed: () => {
        const { bitLength, chunkLength, compress, fromV8 } = base32
        const init = {
            chunkLength,
            lengthLength: bitLength << 1n,
            digestLength: bitLength << 3n,
            compress,
            digest: fromV8,
        }
        const { hash } = sha256.init
        const abc = [utf8('abc')]
        return {
            // `sha256` rebuilt from its parts is `sha256`.
            sha256: () => {
                const h = framed(init, hash, 256n)
                checkBytes(h)(32n, 64n)
                assertEq(computeSync(h)(abc), computeSync(sha256)(abc))
            },
            // The shortest hash the bound admits: the digest's top bit.
            oneBit: () => assertEq(uint(computeSync(framed(init, hash, 1n))(abc)), uint(computeSync(sha256)(abc)) >> 255n),
            throw: {
                zero: () => { framed(init, hash, 0n) },
                pastDigest: () => { framed(init, hash, 257n) },
            },
        }
    },
    sha2: {
        sha256: () => checkEmpty(sha256)(0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855n),
        sha224: () => checkEmpty(sha224)(0xd14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42fn),
        sha512: () => checkEmpty(sha512)(0xcf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3en),
        sha384: () => checkEmpty(sha384)(0x38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95bn),
        sha512x256: () => checkEmpty(sha512x256)(0xc672b8d1ef56ed28ab87c3622c5114069bdd3ad7b8f9737498d0c01ecef0967an),
        sha512x224: () => checkEmpty(sha512x224)(0x6ed0dd02806fa89e25de060c19d3ac86cabb87d6a0ddd05c333b84f4n),
    },
    // The byte counts consumers read instead of converting bit lengths
    // themselves. Asserted against the bit length each is derived from, not
    // against a hand-written number, so the pairing is what is pinned.
    byteLengths: [
        () => checkBytes(sha224)(28n, 64n),
        () => checkBytes(sha256)(32n, 64n),
        () => checkBytes(sha384)(48n, 128n),
        () => checkBytes(sha512)(64n, 128n),
        () => checkBytes(sha512x224)(28n, 128n),
        () => checkBytes(sha512x256)(32n, 128n),
    ],
    utf8: [
        () => {
            const e = 0x730e109bd7a8a32b1cb9d9a09aa2325d2430587ddbc0c38bad911525n
            {
                const s = utf8("The quick brown fox jumps over the lazy dog")
                const h = computeSync(sha224)([s])
                assertEq(uint(h), e, h)
            }
            {
                const s = ['The', ' quick', ' brown', ' fox', ' jumps', ' over', ' the', ' lazy', ' dog']
                const h = computeSync(sha224)(map(utf8)(s))
                assertEq(uint(h), e, h)
            }
        },
        () => {
            const s = utf8("The quick brown fox jumps over the lazy dog.")
            const h = computeSync(sha224)([s])
            assertEq(uint(h), 0x619cba8e8e05826e9b8c519c0a5c68f4fb653e8a3d8aa04bb2c8cd4cn, h)
        },
        () => {
            const s = utf8("hello world")
            assertEq(uint(s), 0x68656C6C_6F20776F_726C64n, s)
            let state = sha256.init
            state = sha256.append(s)(state)
            const h = sha256.end(state)
            assertEq(uint(h), 0xb94d27b9_934d3e08_a52e52d7_da7dabfa_c484efe3_7a5380ee_9088f7ac_e2efcde9n, h)
        }
    ],
    fill: () => {
        const times = flip(repeat)(vec(32n)(0x31313131n))
        return {
            8: () => {
                const r = times(8n)
                let state = sha256.init
                state = sha256.append(r)(state)
                const h = uint(sha256.end(state))
                assertEq(h >> 224n, 0x8a83665fn, h)
            },
            16: () => {
                const r = times(16n)
                let state = sha256.init
                state = sha256.append(r)(state)
                const h = sha256.end(state)
                assertEq(uint(h), 0x3138bb9b_c78df27c_473ecfd1_410f7bd4_5ebac1f5_9cf3ff9c_fe4db77a_ab7aedd3n, h)
            }
        }
    },
    padding: {
        overflow: () => {
            const zero = vec(8n)(0n)
            const msg = flip(repeat)(zero)(113n)
            const h = computeSync(sha384)([msg])
            const x = 0x6be9af2cf3cd5dd12c8d9399ec2b34e66034fbd699d4e0221d39074172a380656089caafe8f39963f94cc7c0a07e3d21n
            assertEq(uint(h), x, h)
        },
    },
    // Regression guard (sha2-append-quadratic): `append` used to be
    // quadratic in the input size, not linear — a single call on a
    // 100,000-byte `Vec` used to cost real seconds and scale worse than
    // O(n²); now near-linear (~40-60ms on Node, well under `bun test`'s 5s
    // per-test limit on Bun). No timing assertion (duration varies by
    // engine/machine); relies on the test runner's own per-test timing to
    // catch a regression, same convention as `fjs/basen/base64/proof.f.mjs`
    // `encodeLargeVecIsSlow`.
    // A remainder held, then a `Vec` as long as a `Vec` may be, for one
    // variant of each word size: the framing never joins the two into one,
    // which would be over the ceiling every host honours.
    remainderThenFull: () => {
        const a = vec(8n)(0x61n)
        const check = heldThenFull(a, repeat(maxLengthBytes)(a))
        check(sha256)
        check(sha512)
    },
    // The block a held remainder is completed into, pinned: one variant of
    // each word size, over a message no two bytes of which are alike.
    seam: () => {
        seam(sha256)
        seam(sha512)
    },
    appendLargeVecIsFast: () => {
        const big = repeat(100_000n)(vec(8n)(0xffn))
        let state = sha256.init
        state = sha256.append(big)(state)
        const h = sha256.end(state)
        const x = 0xbe87f6dbe42cdf682276fbecab3636fbfcaa008cf454d635dd77872b50d940aan
        assertEq(uint(h), x, h)
    },
    demo: {
        multiline: () => {
            const text = '\nfirst\nsecond\n'
            const expected = '2bafaf440fc5569ecabc492ff1f4c24928bdb0a5bd1a793ea05f364d7cb671ed'
            assertEq(digest(text), expected)
            const state = unwrap(assertNotNullish(runPure(demo.update(demo.init)({ kind: 'input', name: 'text', value: text }))[0]))
            assertEq(state.text, text)
            const html = htmlToString(demo.view(state))
            assert(html.includes(`<textarea id="text" name="text" rows="8">${text}</textarea>`), html)
            assert(html.includes(`<pre>${expected}</pre>`), html)
            assert(html.includes(`<pre>printf '%s' '${text}' | openssl dgst -sha256</pre>`), html)
        },
        /**
         * **The digest the demo shows is this module's own.** The empty
         * string's is the value `checkEmpty` already pins above, written in
         * hex — which is also what `sha256sum` prints, so the page can be
         * checked from outside this repository. A change to the hash or to
         * the way the demo renders it lands here rather than only on a page
         * nobody is looking at.
         */
        digest: () => {
            // The same literal `checkEmpty` pins above, said in hex — which is
            // also what `sha256sum` prints, so the page can be checked from
            // outside this repository.
            assertEq(digest(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
            assertEq(digest('').length, 64)
            assertEq(digest('hello'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
            // `1234` hashes to `03ac…`, whose leading hex *digit* is zero:
            // four bits, so one digest in sixteen does it. That is the input
            // the pad exists for — without it this prints 63 characters that
            // still look like a digest.
            assertEq(digest('1234'), '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
        },
        // Typing replaces the text, selecting replaces the algorithm, and every
        // other event leaves both alone.
        update: () => {
            /**
             * **`runPure` and not a call.** An effect is a `Pure` thunk or a
             * `Do` node, and only the first is callable; `[r]` says this demo
             * reached a value without asking for an operation, which is what
             * `O = never` claims.
             *
             * @type {(event: DemoEvent) => (state: typeof demo.init) => typeof demo.init}
             */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(
                JSON.stringify(step({ kind: 'input', name: 'text', value: 'hello' })(demo.init)),
                JSON.stringify({ algorithm: 'SHA-256', text: 'hello' }))
            assertEq(
                JSON.stringify(step({ kind: 'input', name: 'algorithm', value: 'SHA-512' })(demo.init)),
                JSON.stringify({ algorithm: 'SHA-512', text: '' }))
            assertEq(JSON.stringify(step({ kind: 'start' })(demo.init)), JSON.stringify(demo.init))
            assertEq(JSON.stringify(step({ kind: 'input', name: 'other', value: 'ignored' })(demo.init)), JSON.stringify(demo.init))
        },
        /**
         * **The fields carry names, and that is the contract.** They come back
         * as the event's `name`, so the demo tells the selector and text input
         * apart without ever holding a DOM node.
         */
        view: () => {
            const empty = htmlToString(demo.view(demo.init))
            assert(empty.includes('name="algorithm"'), empty)
            assert(empty.includes('name="text"'), empty)
            assert(empty.includes(digest('')), empty)
            assert(empty.includes('openssl dgst -sha256'), empty)
            const typed = htmlToString(demo.view({ algorithm: 'SHA-256', text: 'hello' }))
            assert(typed.includes('<textarea id="text" name="text" rows="8">hello</textarea>'), typed)
            assert(typed.includes(digest('hello')), typed)
            assert(typed.includes("<pre>printf '%s' 'hello' | openssl dgst -sha256</pre>"), typed)
            assert(typed.includes('aria-label="Copy digest"'), typed)
            assert(typed.includes('aria-label="Copy OpenSSL command"'), typed)
            const quoted = htmlToString(demo.view({ algorithm: 'SHA-256', text: "a'b $HOME `whoami` \\" }))
            assert(quoted.includes("<pre>printf '%s' 'a'\\''b $HOME `whoami` \\' | openssl dgst -sha256</pre>"), quoted)
            const sha512 = htmlToString(demo.view({ algorithm: 'SHA-512', text: 'hello' }))
            assert(sha512.includes('openssl dgst -sha512'), sha512)
        },
        throw: {
            unknownAlgorithm: () => { demo.view({ algorithm: 'unknown', text: 'hello' }) },
        },
    },
}
