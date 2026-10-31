import { assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { inflateTrailingCode, inflateTrailingMessage } from '../../effects/node/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { run } from '../../types/list/module.f.mjs'
import { hex, storedBytes, streams } from '../../zlib/testlib.f.mjs'
import { bytesOf, feedWithin, inflater, inflateAll, inflateWithin, malformed, sizeOf } from './module.f.mjs'

const { init: [, , initialProgress], update: updateInflate, end: endInflate } = inflater
const runInflater = run(inflater)

/** @type {(bytes: readonly number[], size: number) => readonly import('../../types/bit_vec/types.ts').Vec[]} */
const chunks = (bytes, size) => Array.from({ length: Math.ceil(bytes.length / size) }, (_, i) => u8ListToVecMsb(bytes.slice(i * size, (i + 1) * size)))

/** What a read of the chunks gave: the bytes, or the code and the message. */
const read = (/** @type {readonly import('../../types/bit_vec/types.ts').Vec[]} */ cs) => {
    const r = inflateAll(cs)
    return r[0] === 'ok' ? ['ok', toArray(bytesOf(r[1]))] : ['error', r[1].code, r[1].message]
}

const abc = [0x61, 0x62, 0x63]
const stream = storedBytes(abc)

export const proof = {
    // A stream held whole, in one chunk or many: its bytes.
    whole: () => {
        assertStructurallySame(read(chunks(stream, 1000)), ['ok', abc])
        assertStructurallySame(read(chunks(stream, 3)), ['ok', abc])
        assertStructurallySame(read(chunks(stream, 1)), ['ok', abc])
    },
    // A stream of Huffman blocks, and one that is many output chunks.
    huffman: () => {
        const zeros = assertOk(inflateAll(chunks(hex(streams.zeros), 100)))
        assertEq(sizeOf(zeros), 300_000)
        assertEq(toArray(bytesOf(zeros)).length, 300_000)
        assertEq(sizeOf(null), 0)
    },
    // A chunk is inflated a piece at a time and not read on once the output is
    // over the limit: five thousand bytes of output are a few pieces, and the limit
    // stops it after the first one that passes it, not after the chunk.
    pieces: () => {
        const bytes = Array.from({ length: 5_000 }, (_, i) => i & 0xff)
        const chunk = u8ListToVecMsb(storedBytes(bytes).slice(0, 5_000 + 5 + 2))
        const whole = feedWithin(1_000_000)(chunk)(initialProgress)
        assertEq(whole?.size, 5_000)
        const stopped = feedWithin(100)(chunk)(initialProgress)
        assertEq(stopped !== null && stopped.size > 100 && stopped.size < 5_000, true)
        // a chunk that makes the stream malformed is, wherever its piece falls
        assertEq(feedWithin(1_000_000)(u8ListToVecMsb([0, 0]))(initialProgress), null)
        // and one that is empty gives the stream as it was
        assertStructurallySame(feedWithin(0)(u8ListToVecMsb([]))(initialProgress), initialProgress)
    },
    // The split into pieces bounds the read of `inflateWithin` too: the limit is asked
    // with the output of the first piece of a chunk, 1 KiB of input and so 1 017 bytes
    // here, and not of the whole chunk. Asked with its own length it answers that, so
    // the pieces after the first go over it; asked at the end of the chunk, it would
    // allow every byte.
    withinSplitsChunks: () => {
        const stream = storedBytes(Array.from({ length: 5_000 }, (_, i) => i & 0xff))
        const r = inflateWithin(32, output => toArray(output).length)([u8ListToVecMsb(stream)])
        assertStructurallySame(r, ['ok', null])
    },
    // The stream is read while its output is within the limit the first bytes give,
    // and not past it: a chunk after the one that goes over is not looked at.
    within: () => {
        const bytes = Array.from({ length: 40 }, (_, i) => i)
        const all = storedBytes(bytes)
        // the chunk that holds the data, and one that would end it badly
        const cut = [u8ListToVecMsb(all.slice(0, all.length - 4)), u8ListToVecMsb([0xff])]
        const read = (/** @type {number} */ head, /** @type {(output: readonly number[]) => number | null} */ limitOf, /** @type {readonly import('../../types/bit_vec/types.ts').Vec[]} */ cs) => {
            const r = inflateWithin(head, output => limitOf(toArray(output)))(cs)
            return r[0] === 'ok' ? ['ok', r[1] === null ? null : toArray(bytesOf(r[1]))] : ['error', r[1].code]
        }
        // within the limit, the whole stream
        assertStructurallySame(read(32, () => 40, chunks(all, 7)), ['ok', bytes])
        // the limit is asked with the first bytes, once there are enough of them
        assertStructurallySame(read(32, output => output.length === 40 ? 5 : 100, chunks(all, 1000)), ['ok', null])
        // past it, the read stops, and what follows is not an error
        assertStructurallySame(read(32, () => 10, cut), ['ok', null])
        assertStructurallySame(read(32, () => null, cut), ['ok', null])
        // a stream that never holds that many bytes is not asked
        assertStructurallySame(read(64, () => 0, chunks(all, 1000)), ['ok', bytes])
        // and a malformed one is the inflater's
        assertStructurallySame(read(32, () => 40, chunks([0, 0], 1)), ['error', 'Z_DATA_ERROR'])
    },
    // A stream that is malformed, wherever the chunk that makes it so falls.
    malformed: () => {
        assertStructurallySame(read(chunks([0x78, 0x9d, ...stream.slice(2)], 4)), ['error', malformed.code, malformed.message])
        assertStructurallySame(read(chunks([0x78, 0x9d, ...stream.slice(2)], 1000)), ['error', 'Z_DATA_ERROR', 'invalid zlib stream'])
        assertStructurallySame(updateInflate(initialProgress, u8ListToVecMsb([0x78, 0x9d])), ['done', [], ['error', malformed]])
    },
    // A malformed chunk completes before the lazy source is pulled again.
    stopsAtMalformed: () => {
        const source = /** @type {const} */ ({ first: u8ListToVecMsb([0, 0]), tail: () => { throw 'pulled after refusal' } })
        assertStructurallySame(runInflater(source), ['error', malformed])
    },
    // A stream that ends before it closes, or never begins.
    truncated: () => {
        assertStructurallySame(read(chunks(stream.slice(0, stream.length - 1), 4)), ['error', 'Z_BUF_ERROR', 'unexpected end of file'])
        assertStructurallySame(read([]), ['error', 'Z_BUF_ERROR', 'unexpected end of file'])
    },
    // Bytes after the stream, as the host's `inflate` refused them.
    trailing: () => {
        assertStructurallySame(read(chunks([...stream, 7, 8, 9], 5)), ['error', inflateTrailingCode, inflateTrailingMessage(3)])
        assertEq(endInflate(initialProgress)[2][0], 'error')
    },
    // More trailing bytes than a `Vec` holds are still refused, not thrown at.
    trailingPastAVec: () => {
        const after = 0x3_0000
        assertStructurallySame(
            read(chunks([...stream, ...Array.from({ length: after }, () => 7)], 0xffff)),
            ['error', inflateTrailingCode, inflateTrailingMessage(after)])
    },
}
