import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { u8ListToVecMsb, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { run } from '../../types/list/module.f.mjs'
import { codePoints } from '../../text/ascii/module.f.js'
import { adler32, appendBytes } from './module.f.mjs'

const checksumOf = run(adler32)

/**
 * The checksum of `bytes` given in `pieces`, as the number it spells.
 *
 * @type {(...pieces: readonly (readonly number[])[]) => bigint}
 */
const adler = (...pieces) => uint(checksumOf(pieces.map(u8ListToVecMsb)))

// The expected values are the last four bytes of Node's `zlib.deflateSync` of
// the same bytes, which is the Adler-32 zlib closes its stream with.

export const proof = {
    // The checksum of nothing is where it starts, and so is a `Vec` of no bytes.
    empty: () => {
        assertStructurallySame(adler32.init, ['next', [], 1])
        assertEq(adler(), 1n)
        assertEq(adler([]), 1n)
    },
    // The example RFC 1950's Wikipedia article gives.
    wikipedia: () => { assertEq(adler(codePoints('Wikipedia')), 0x11e6_0398n) },
    // Bytes of 0xff are the worst case for `a` and `b`, which reduce
    // modulo 65 521 well before 5 552 of them, the most zlib sums at once.
    reduces: () => {
        assertEq(adler(Array(5552).fill(0xff)), 0xf18f_9b8cn)
        assertEq(adler(Array(100_000).fill(0xff)), 0x149a_302cn)
    },
    // The checksum of a message in pieces is the message's, wherever the
    // pieces meet: only bytes that differ tell the order apart.
    seam: () => {
        const bytes = Array.from({ length: 3000 }, (_, i) => (i * 37 + 11) & 0xff)
        const whole = 0x0b45_d508n
        assertEq(adler(bytes), whole)
        for (const at of [0, 1, 1500, 2999, 3000]) {
            assertEq(adler(bytes.slice(0, at), bytes.slice(at)), whole, at)
        }
    },
    // The checksum as it closes a stream: four bytes, the most significant first.
    end: () => {
        assertStructurallySame(adler32.end(0x11e6_0398), ['done', [], vec(32n)(0x11e6_0398n)])
        assertStructurallySame(adler32.end(1), ['done', [], vec(32n)(1n)])
    },
    // The same over bytes, which is what `update` is over a `Vec`, and in pieces.
    bytes: () => {
        const bytes = Array.from({ length: 3000 }, (_, i) => (i * 37 + 11) & 0xff)
        assertEq(appendBytes(bytes)(1), 0x0b45_d508)
        assertEq(appendBytes(bytes.slice(1000))(appendBytes(bytes.slice(0, 1000))(1)), 0x0b45_d508)
        assertEq(appendBytes([])(1), 1)
    },
    // A saved checksum state resumes independently of the source that made it.
    resume: () => {
        const [tag, output, state] = adler32.update(1, u8ListToVecMsb(codePoints('Wiki')))
        assert(tag === 'next')
        assertStructurallySame(output, [])
        const resumed = /** @type {const} */ ({ ...adler32, init: ['next', [], state] })
        assertEq(uint(run(resumed)([u8ListToVecMsb(codePoints('pedia'))])), 0x11e6_0398n)
    },
    throw: {
        // More bytes than the sums hold exactly are read in pieces.
        // only its length is read before it is refused
        tooMany: () => appendBytes(/** @type {readonly number[]} */ (/** @type {unknown} */ ({ length: 0x80_0001 })))(1),
        // A `Vec` that is not whole bytes is no message.
        notBytes: () => adler32.update(1, vec(7n)(0x55n)),
    },
}
