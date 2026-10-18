import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { inflateTrailingCode, inflateTrailingMessage } from '../../effects/node/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { hex, storedBytes, streams } from '../../zlib/testlib.f.mjs'
import { bytesOf, feed, finish, inflateAll, malformed, sizeOf, start } from './module.f.mjs'

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
        const zeros = inflateAll(chunks(hex(streams.zeros), 100))
        if (zeros[0] === 'error') { throw zeros[1] }
        assertEq(sizeOf(zeros[1]), 300_000)
        assertEq(toArray(bytesOf(zeros[1])).length, 300_000)
        assertEq(sizeOf(null), 0)
    },
    // A stream that is malformed, wherever the chunk that makes it so falls.
    malformed: () => {
        assertStructurallySame(read(chunks([0x78, 0x9d, ...stream.slice(2)], 4)), ['error', malformed.code, malformed.message])
        assertStructurallySame(read(chunks([0x78, 0x9d, ...stream.slice(2)], 1000)), ['error', 'Z_DATA_ERROR', 'invalid zlib stream'])
        assertEq(feed(u8ListToVecMsb([0x78, 0x9d]))(start), null)
    },
    // A stream that ends before it closes, or never begins.
    truncated: () => {
        assertStructurallySame(read(chunks(stream.slice(0, stream.length - 1), 4)), ['error', 'Z_BUF_ERROR', 'unexpected end of file'])
        assertStructurallySame(read([]), ['error', 'Z_BUF_ERROR', 'unexpected end of file'])
    },
    // Bytes after the stream, as the host's `inflate` refused them.
    trailing: () => {
        assertStructurallySame(read(chunks([...stream, 7, 8, 9], 5)), ['error', inflateTrailingCode, inflateTrailingMessage(3)])
        assertEq(finish(start)[0], 'error')
    },
    // More trailing bytes than a `Vec` holds are still refused, not thrown at.
    trailingPastAVec: () => {
        const after = 0x3_0000
        assertStructurallySame(
            read(chunks([...stream, ...Array.from({ length: after }, () => 7)], 0xffff)),
            ['error', inflateTrailingCode, inflateTrailingMessage(after)])
    },
}
