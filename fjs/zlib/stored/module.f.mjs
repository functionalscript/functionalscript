/**
 * A zlib stream of stored blocks: bytes framed as RFC 1950 frames a stream
 * and RFC 1951 frames a block that compresses nothing, which is what a
 * writer needs when it has to produce a stream and has no deflater — a Git
 * loose object is one zlib stream, and Git inflates a stored one as it
 * inflates any other.
 *
 * The stream is the two-byte header `0x78 0x01` — deflate with a 32 KiB
 * window and the fastest level, the header Git itself writes at level 1 —
 * then one stored block per 65 535 bytes, each `BFINAL BTYPE=00` as a byte,
 * `LEN` and `NLEN` little-endian, then the bytes, and after the last block
 * the Adler-32 of the data, most significant byte first. No bytes is one
 * empty final block, since a stream has at least one block.
 *
 * The inverse is [`fjs/zlib/inflate`](../inflate/module.f.mjs), which reads
 * this as it reads a stream a deflater made.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 */

import { byteLength, u8ArrayMsb, u8ListMsb, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { flat, toArray } from '../../types/list/module.f.mjs'
import { append, end, init } from '../adler32/module.f.mjs'

/** The most bytes a stored block holds: `LEN` is sixteen bits. */
const blockBytes = 0xffff

/** The bytes in blocks of as many as a block holds, the last one shorter. */
const blocksOf = u8ListToVecChunksMsb(blockBytes)

/** The zlib header: CM 8, CINFO 7, FLEVEL fastest, FCHECK making the pair a multiple of 31. */
const header = [0x78, 0x01]

/**
 * A stored block's header: its final flag, then `LEN` and its one's complement
 * `NLEN`, each little-endian.
 *
 * @type {(final: boolean, len: number) => readonly number[]}
 */
const blockHeader = (final, len) => [final ? 1 : 0, len & 0xff, len >> 8, ~len & 0xff, ~len >> 8 & 0xff]

/**
 * `bytes` as a zlib stream of stored blocks. The bytes are walked twice, once
 * into blocks and once for the checksum, and held as blocks meanwhile; a
 * stream the inflater reads back to the same bytes, as its proof shows.
 *
 * @throws If an item of `bytes` is not a byte.
 *
 * @type {(bytes: List<number>) => List<number>}
 */
export const stored = bytes => {
    const blocks = toArray(blocksOf(bytes))
    const last = blocks.length - 1
    const body = blocks.length === 0
        ? [blockHeader(true, 0)]
        : blocks.flatMap((block, i) => [blockHeader(i === last, Number(byteLength(block))), u8ListMsb(block)])
    const checksum = u8ArrayMsb(end(blocks.reduce((state, block) => append(block)(state), init)))
    return flat([header, ...body, checksum])
}
