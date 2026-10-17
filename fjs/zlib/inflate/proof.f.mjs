import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { u8ListMsb, u8ListToVecMsb, uint, vec } from '../../types/bit_vec/module.f.mjs'
import { fold, toArray } from '../../types/list/module.f.mjs'
import { append as adlerAppend, init as adlerInit } from '../adler32/module.f.mjs'
import { append, end, init } from './module.f.mjs'

/** @type {(vec: import('../../types/bit_vec/types.ts').Vec) => readonly number[]} */
const bytesOf = v => toArray(u8ListMsb(v))

/** @type {(hex: string) => readonly number[]} */
const hex = text => Array.from({ length: text.length / 2 }, (_, i) => parseInt(text.slice(2 * i, 2 * i + 2), 16))

/**
 * What a stream read in `pieces` gave: the output as bytes, and the bytes after
 * the stream, or `null` where a piece was refused. `rest` is `null` while the
 * stream has not closed.
 *
 * @type {(...pieces: readonly (readonly number[])[]) => { readonly output: readonly number[], readonly rest: readonly number[] | null } | null}
 */
const read = (...pieces) => {
    let state = init
    let output = /** @type {readonly number[]} */ ([])
    for (const piece of pieces) {
        const result = append(u8ListToVecMsb(piece))(state)
        if (result === null) { return null }
        state = result.state
        output = [...output, ...result.output.flatMap(bytesOf)]
    }
    const rest = end(state)
    return { output, rest: rest === null ? null : bytesOf(rest) }
}

/** A stream of stored blocks, the last one flagged, closed by the Adler-32 of the bytes. */
const stored = (/** @type {readonly (readonly number[])[]} */ blocks) => {
    const sum = fold(adlerAppend)(adlerInit)(blocks.map(u8ListToVecMsb))
    return [
        0x78, 0x01,
        ...blocks.flatMap((block, i) => {
            const len = block.length
            return [i === blocks.length - 1 ? 1 : 0, len & 0xff, len >> 8, ~len & 0xff, ~len >> 8 & 0xff, ...block]
        }),
        ...bytesOf(vec(32n)(BigInt(sum))),
    ]
}

/** Seventy thousand bytes that differ from their neighbours. */
const data = Array.from({ length: 70_000 }, (_, i) => (i * 31 + 7) & 0xff)

// The vectors are `zlib.deflateSync(…, { level: 0 })` of Node, which makes the
// stored blocks; its zlib starts a second block after 65 531 bytes, and the
// same split below makes the same stream.
const abc = hex('7801010300fcff616263024d0127')

/** @type {(bytes: readonly number[], at: number) => readonly (readonly number[])[]} */
const split = (bytes, at) => [bytes.slice(0, at), bytes.slice(at)]

export const proof = {
    // One stored block, and the empty stream, which is one with no bytes.
    stored: () => {
        assertStructurallySame(read(abc), { output: [0x61, 0x62, 0x63], rest: [] })
        assertStructurallySame(read(hex('7801010000ffff00000001')), { output: [], rest: [] })
        assertStructurallySame(stored([[0x61, 0x62, 0x63]]), abc)
    },
    // A stream of two blocks, as Node's zlib splits seventy thousand bytes, and
    // the output of each block is a chunk of its own.
    twoBlocks: () => {
        const stream = stored([data.slice(0, 65_531), data.slice(65_531)])
        const result = append(u8ListToVecMsb(stream))(init)
        assertEq(result === null ? -1 : result.output.map(bytesOf).map(a => a.length).join(), '65531,4469')
        assertStructurallySame(read(stream), { output: data, rest: [] })
    },
    // Blocks of no bytes, between the others and last.
    emptyBlocks: () => {
        assertStructurallySame(read(stored([[], [1, 2], [], [3], []])), { output: [1, 2, 3], rest: [] })
    },
    // A stream in pieces is the stream whole, wherever the pieces meet: the
    // header, a block's opening, its lengths, its bytes and the checksum.
    pieces: () => {
        const stream = stored([[1, 2, 3], [], [4, 5]])
        const whole = { output: [1, 2, 3, 4, 5], rest: [] }
        assertStructurallySame(read(stream), whole)
        for (let at = 0; at <= stream.length; at += 1) {
            assertStructurallySame(read(...split(stream, at)), whole)
        }
        assertStructurallySame(read(...stream.map(byte => [byte])), whole)
        assertStructurallySame(read(...split(stored([data.slice(0, 65_531), data.slice(65_531)]), 40_000)), { output: data, rest: [] })
    },
    // Bytes after the stream are the reader's: handed back, whether they came
    // with the last piece or after it.
    rest: () => {
        assertStructurallySame(read([...abc, 7, 8, 9]), { output: [0x61, 0x62, 0x63], rest: [7, 8, 9] })
        assertStructurallySame(read(abc, [7], [8, 9]), { output: [0x61, 0x62, 0x63], rest: [7, 8, 9] })
    },
    // A stream that has not closed has no rest, wherever it is cut: it is not
    // refused, since more may come.
    open: () => {
        for (let length = 0; length < abc.length; length += 1) {
            const result = read(abc.slice(0, length))
            assertEq(result === null, false, length)
            assertEq(result?.rest, null, length)
        }
    },
    // The header: a multiple of 31, the deflate method, a window of at most
    // 32 KiB, and no preset dictionary.
    header: () => {
        for (const header of [[0x78, 0x9d], [0x00, 0x00], [0x88, 0x1c], [0x78, 0xbb]]) {
            assertEq(read([...header, ...abc.slice(2)]), null, header)
        }
        assertStructurallySame(read([0x58, 0x85, ...abc.slice(2)]), { output: [0x61, 0x62, 0x63], rest: [] })
    },
    // Only the stored type is read so far: a block of codes is refused, and 3
    // is not a type.
    blocks: () => {
        for (const opening of [0x03, 0x05, 0x07]) {
            assertEq(read([0x78, 0x9c, opening]), null, opening)
        }
        // Node's fixed-Huffman stream of `hello hello hello hello`.
        assertEq(read(hex('7801cb48cdc9c957c8402701680308b1')), null)
    },
    // `NLEN` is the complement of `LEN`, and the checksum is the output's.
    checks: () => {
        assertEq(read([0x78, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x61]), null)
        assertEq(read(abc.map((byte, i) => i === abc.length - 1 ? byte ^ 1 : byte)), null)
        // a refusal after output was made is the refusal of the chunk that has it
        assertEq(read(abc.slice(0, 10), abc.slice(10, 13), [0, 0, 0, 0]), null)
    },
    throw: {
        // A `Vec` that is not whole bytes is no input.
        notBytes: () => append(vec(7n)(0x55n))(init),
    },
}
