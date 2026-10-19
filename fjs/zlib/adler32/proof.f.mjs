import { assertEq } from '../../asserts/module.f.mjs'
import { u8ListToVecMsb, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { fold } from '../../types/list/module.f.mjs'
import { append, appendBytes, end, init } from './module.f.mjs'

/**
 * The checksum of `bytes` given in `pieces`, as the number it spells.
 *
 * @type {(...pieces: readonly (readonly number[])[]) => bigint}
 */
const adler = (...pieces) => uint(end(fold(append)(init)(pieces.map(u8ListToVecMsb))))

/** @type {(text: string) => readonly number[]} */
const ascii = text => Array.from(text, c => c.charCodeAt(0))

// The expected values are the last four bytes of Node's `zlib.deflateSync` of
// the same bytes, which is the Adler-32 zlib closes its stream with.

export const proof = {
    // The checksum of nothing is where it starts, and so is a `Vec` of no bytes.
    empty: () => {
        assertEq(init, 1)
        assertEq(adler(), 1n)
        assertEq(adler([]), 1n)
    },
    // The example RFC 1950's Wikipedia article gives.
    wikipedia: () => { assertEq(adler(ascii('Wikipedia')), 0x11e6_0398n) },
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
        assertEq(end(0x11e6_0398), vec(32n)(0x11e6_0398n))
        assertEq(end(1), vec(32n)(1n))
    },
    // The same over bytes, which is what `append` is over a `Vec`, and in pieces.
    bytes: () => {
        const bytes = Array.from({ length: 3000 }, (_, i) => (i * 37 + 11) & 0xff)
        assertEq(appendBytes(bytes)(init), 0x0b45_d508)
        assertEq(appendBytes(bytes.slice(1000))(appendBytes(bytes.slice(0, 1000))(init)), 0x0b45_d508)
        assertEq(appendBytes([])(init), init)
    },
    throw: {
        // More bytes than the sums hold exactly are read in pieces.
        // only its length is read before it is refused
        tooMany: () => appendBytes(/** @type {readonly number[]} */ (/** @type {unknown} */ ({ length: 0x80_0001 })))(init),
        // A `Vec` that is not whole bytes is no message.
        notBytes: () => append(vec(7n)(0x55n))(init),
    },
}
