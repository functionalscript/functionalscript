import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { bytesOf, inflateAll } from '../../git/inflater/module.f.mjs'
import { u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { noise, storedBytes, text } from '../testlib.f.mjs'
import { stored } from './module.f.mjs'

/**
 * The stream inflated by [`fjs/zlib/inflate`](../inflate/module.f.mjs)
 * through the Git inflater, back to the bytes it holds.
 *
 * @type {(stream: readonly number[]) => readonly number[]}
 */
const inflated = stream => toArray(bytesOf(assertOk(inflateAll(toArray(u8ListToVecChunksMsb(0x1_0000)(stream))))))

/**
 * Bytes a deflater would find nothing in, at the sizes where the framing
 * changes shape: none, one, a full block, one over, and many blocks. Made
 * once, since the two cases below compare over the same inputs.
 */
const inputs = [0, 1, 0xffff, 0x1_0000, 150_000].map(noise)

/** Text, which deflate would find matches in and a stored stream frames all the same. */
const words = text(1_000)

export const proof = {
    // The inflater reads the stream back to the bytes, at every size where the
    // block framing changes shape.
    roundTrip: () => {
        for (const bytes of [...inputs, words]) {
            assertStructurallySame(inflated(toArray(stored(bytes))), bytes, bytes.length)
        }
    },
    // The same framing as the fixture writer the zlib proofs use, byte for
    // byte: two spellings of RFC 1950 and 1951 that agree, which pins the
    // header, the block headers and the checksum without a decoder in between.
    agreesWithFixture: () => {
        for (const bytes of [...inputs, words]) {
            assertStructurallySame(toArray(stored(bytes)), storedBytes(bytes), bytes.length)
        }
    },
    // The shape, read off the stream itself: the zlib header, one final empty
    // block, and the Adler-32 of nothing.
    empty: () => {
        const s = toArray(stored([]))
        assertStructurallySame(s, [0x78, 0x01, 1, 0, 0, 0xff, 0xff, 0, 0, 0, 1])
    },
    // A single byte: one final block of length one.
    one: () => {
        const s = toArray(stored([0x61]))
        assertEq(s.length, 2 + 5 + 1 + 4)
        assert(s[2] === 1 && s[3] === 1 && s[4] === 0 && s[5] === 0xfe && s[6] === 0xff, s)
    },
}
