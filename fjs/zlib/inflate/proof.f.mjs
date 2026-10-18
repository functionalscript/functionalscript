import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { u8ListToVecMsb, vec } from '../../types/bit_vec/module.f.mjs'
import { bytes, bytesOf, closing, field, hex, noise, stored, streams, text, written } from '../testlib.f.mjs'
import { append, end, init } from './module.f.mjs'

/**
 * What a stream read in `pieces` gave: the output as bytes, and the bytes after
 * the stream, or `null` where a piece was refused. `rest` is `null` while the
 * stream has not closed.
 *
 * @type {(...pieces: readonly (readonly number[])[]) => { readonly output: readonly number[], readonly rest: number | null } | null}
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
    return { output, rest: end(state) }
}

/** Seventy thousand bytes that differ from their neighbours. */
const data = Array.from({ length: 70_000 }, (_, i) => (i * 31 + 7) & 0xff)

// The stored vectors are `zlib.deflateSync(…, { level: 0 })` of Node, which makes
// the stored blocks; its zlib starts a second block after 65 531 bytes, and the
// same split below makes the same stream.
const abc = hex('7801010300fcff616263024d0127')

// Node's streams of the Huffman kinds: fixed, dynamic, with a copy that
// repeats, and with nothing to copy.
const hello = hex('7801cb48cdc9c957c8402701680308b1')
const helloText = Array.from('hello hello hello hello', c => c.charCodeAt(0))
const fox = hex('789c2bc94855282ccd4cce56482aca2fcf5348cbaf50c82acd2d2856c82f4b2d5228014ae72456552aa4e4a7eb8179a38a47158f2aa6aa6200e521459c')
const foxText = Array.from('the quick brown fox jumps over the lazy dog. '.repeat(20), c => c.charCodeAt(0))
const a100 = hex('789c4b4ca43d00007a4725e5')
const emptyFixed = hex('789c030000000001')

/** @type {(bytes: readonly number[], at: number) => readonly (readonly number[])[]} */
const split = (bytes, at) => [bytes.slice(0, at), bytes.slice(at)]

/** Bytes as the pieces of `size`, the last the rest. @type {(bytes: readonly number[], size: number) => readonly (readonly number[])[]} */
const pieces = (bytes, size) => Array.from({ length: Math.ceil(bytes.length / size) }, (_, i) => bytes.slice(i * size, (i + 1) * size))

// Node's streams, and the bytes each one holds.
const text3000 = text(3000)
const expected = /** @type {const} */ ({
    text1: text3000,
    text6: text3000,
    text9: text3000,
    fixed: text3000,
    huffman: text3000,
    rle: Array(3000).fill(7),
    noise: noise(1500),
    zeros: Array(300_000).fill(0),
    repeat: Array.from({ length: 14 }, () => text3000).flat(),
})

// Blocks of fixed codes, written by hand: a literal is its code, a copy a length
// symbol, its extra bits, a distance symbol of five bits, and its extra bits.

/** The base and the extra bits of the length symbols 257 to 285, and of the distance symbols. */
const lengths = [[3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 1], [13, 1], [15, 1], [17, 1], [19, 2], [23, 2], [27, 2], [31, 2], [35, 3], [43, 3], [51, 3], [59, 3], [67, 4], [83, 4], [99, 4], [115, 4], [131, 5], [163, 5], [195, 5], [227, 5], [258, 0]]
const distances = [[1, 0], [2, 0], [3, 0], [4, 0], [5, 1], [7, 1], [9, 2], [13, 2], [17, 3], [25, 3], [33, 4], [49, 4], [65, 5], [97, 5], [129, 6], [193, 6], [257, 7], [385, 7], [513, 8], [769, 8], [1025, 9], [1537, 9], [2049, 10], [3073, 10], [4097, 11], [6145, 11], [8193, 12], [12289, 12], [16385, 13], [24577, 13]]

/** The fixed code of a literal/length symbol, as written. @type {(symbol: number) => readonly number[]} */
const fixedCode = symbol =>
    (symbol < 144 ? field(0x30 + symbol, 8)
        : symbol < 256 ? field(0x190 + symbol - 144, 9)
            : symbol < 280 ? field(symbol - 256, 7)
                : field(0xc0 + symbol - 280, 8)).toReversed()

/** The symbol of the largest base not above `value`; a length of 258 is symbol 285. @type {(table: readonly (readonly number[])[], value: number) => number} */
const symbolOf = (table, value) => table.reduce((most, [base], symbol) => base <= value ? symbol : most, 0)

/**
 * The bits of an item of a fixed block: a literal byte, or a copy of a length
 * from a distance.
 *
 * @type {(item: number | readonly [number, number]) => readonly number[]}
 */
const item = it => {
    if (typeof it === 'number') { return fixedCode(it) }
    const [length, distance] = it
    const l = length === 258 ? 28 : symbolOf(lengths, length)
    const d = symbolOf(distances, distance)
    return [
        ...fixedCode(257 + l), ...field(length - lengths[l][0], lengths[l][1]),
        ...field(d, 5).toReversed(), ...field(distance - distances[d][0], distances[d][1]),
    ]
}

/** A block of fixed codes, the last or not. @type {(items: readonly (number | readonly [number, number])[], last: boolean) => readonly number[]} */
const fixedBlock = (items, last) => [...field(last ? 1 : 0, 1), ...field(1, 2), ...items.flatMap(item), ...fixedCode(256)]

/** A stream of `blocks`, which are bits, closed by the Adler-32 of `output`. @type {(blocks: readonly number[], output: readonly number[]) => readonly number[]} */
const streamOf = (blocks, output) => [0x78, 0x01, ...bytes(blocks), ...closing(output)]

export const proof = {
    // One stored block, and the empty stream, which is one with no bytes.
    stored: () => {
        assertStructurallySame(read(abc), { output: [0x61, 0x62, 0x63], rest: 0 })
        assertStructurallySame(read(hex('7801010000ffff00000001')), { output: [], rest: 0 })
        assertStructurallySame(stored([[0x61, 0x62, 0x63]]), abc)
    },
    // A stream of two blocks, as Node's zlib splits seventy thousand bytes, and
    // the output of each block is a chunk of its own.
    twoBlocks: () => {
        const stream = stored([data.slice(0, 65_531), data.slice(65_531)])
        const result = append(u8ListToVecMsb(stream))(init)
        assertEq(result === null ? -1 : result.output.map(bytesOf).map(a => a.length).join(), '65531,4469')
        assertStructurallySame(read(stream), { output: data, rest: 0 })
    },
    // Blocks of no bytes, between the others and last.
    emptyBlocks: () => {
        assertStructurallySame(read(stored([[], [1, 2], [], [3], []])), { output: [1, 2, 3], rest: 0 })
    },
    // A fixed block, a dynamic one, a copy that repeats what it writes, and a
    // block of nothing but its end.
    huffman: () => {
        assertStructurallySame(read(hello), { output: helloText, rest: 0 })
        assertStructurallySame(read(fox), { output: foxText, rest: 0 })
        assertStructurallySame(read(a100), { output: Array(100).fill(0x61), rest: 0 })
        assertStructurallySame(read(emptyFixed), { output: [], rest: 0 })
    },
    // Blocks of different kinds in a row: a copy in the second reaches into the
    // first, and a block that ends mid-byte is followed by one that begins there.
    severalBlocks: () => {
        const output = [0x41, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x43]
        const first = fixedBlock([0x41, 0x42, [3, 1]], false)
        const second = fixedBlock([[4, 4], 0x43], true)
        assertStructurallySame(read(streamOf([...first, ...second], output)), { output, rest: 0 })
        // a stored block between two blocks of codes
        // (its opening bits follow the first block's end, and its lengths the next byte)
        const mixed = [
            0x78, 0x01,
            ...bytes([...fixedBlock([0x41], false), ...field(0, 1), ...field(0, 2)]),
            0x01, 0x00, 0xfe, 0xff, 0x42,
            ...bytes(fixedBlock([[3, 1]], true)),
            ...closing([0x41, 0x42, 0x42, 0x42, 0x42]),
        ]
        assertStructurallySame(read(mixed), { output: [0x41, 0x42, 0x42, 0x42, 0x42], rest: 0 })
    },
    // Node's streams at every level it makes, with and without copies, stored
    // and fixed: each is the bytes it was made from.
    nodeStreams: () => {
        for (const [name, hexText] of Object.entries(streams)) {
            if (name === 'zeros') { continue }
            const bytesOfName = expected[/** @type {keyof typeof expected} */ (name)]
            assertStructurallySame(read(hex(hexText)), { output: bytesOfName, rest: 0 }, name)
        }
    },
    // Three hundred thousand bytes from a few hundred: the output is many
    // chunks, none more than a step makes, over a window that copies from itself.
    manyChunks: () => {
        const result = append(u8ListToVecMsb(hex(streams.zeros)))(init)
        if (result === null) { throw 'refused' }
        const sizes = result.output.map(v => bytesOf(v).length)
        assertEq(sizes.reduce((a, b) => a + b, 0), 300_000)
        assertEq(Math.max(...sizes) <= 0x4000 + 258, true)
        assertEq(sizes.length >= 300_000 / (0x4000 + 258), true)
        assertEq(end(result.state) !== null, true)
        assertEq(result.output.flatMap(bytesOf).every(byte => byte === 0), true)
    },
    // A stream in pieces is the stream whole, wherever the pieces meet: in the
    // header, a block's opening, a table description, a symbol and its extra
    // bits, and the checksum.
    pieces: () => {
        for (const [stream, output] of [[abc, [0x61, 0x62, 0x63]], [hello, helloText], [fox, foxText], [a100, Array(100).fill(0x61)], [emptyFixed, []], [hex(streams.rle), expected.rle]]) {
            const whole = { output, rest: 0 }
            for (let at = 0; at <= stream.length; at += 1) {
                assertStructurallySame(read(...split(stream, at)), whole, at)
            }
            assertStructurallySame(read(...stream.map(byte => [byte])), whole)
        }
        const long = hex(streams.text6)
        assertStructurallySame(read(...pieces(long, 1)), { output: text3000, rest: 0 })
        assertStructurallySame(read(...pieces(hex(streams.repeat), 97)), { output: expected.repeat, rest: 0 })
    },
    // Bytes after the stream are the reader's: handed back, whether they came
    // with the last piece or after it, and after a block that ends mid-byte.
    rest: () => {
        assertStructurallySame(read([...abc, 7, 8, 9]), { output: [0x61, 0x62, 0x63], rest: 3 })
        assertStructurallySame(read(abc, [7], [8, 9]), { output: [0x61, 0x62, 0x63], rest: 3 })
        assertStructurallySame(read([...hello, 7, 8, 9]), { output: helloText, rest: 3 })
        assertStructurallySame(read([...fox, 7], [8]), { output: foxText, rest: 2 })
    },
    // What follows is counted, however much: more than a `Vec` holds is no
    // reason to fail.
    restPastAVec: () => {
        const piece = Array.from({ length: 0xffff }, () => 7)
        assertStructurallySame(read(abc, piece, piece, piece, [7]), { output: [0x61, 0x62, 0x63], rest: 0x2_fffe })
    },
    // A stream that has not closed has no rest, wherever it is cut: it is not
    // refused, since more may come.
    open: () => {
        for (const stream of [abc, hello, fox]) {
            for (let length = 0; length < stream.length; length += 1) {
                const result = read(stream.slice(0, length))
                assertEq(result === null, false, length)
                assertEq(result?.rest, null, length)
            }
        }
    },
    // The header: a multiple of 31, the deflate method, a window of at most
    // 32 KiB, and no preset dictionary.
    header: () => {
        for (const header of [[0x78, 0x9d], [0x00, 0x00], [0x88, 0x1c], [0x78, 0xbb]]) {
            assertEq(read([...header, ...abc.slice(2)]), null, header)
        }
        assertStructurallySame(read([0x58, 0x85, ...abc.slice(2)]), { output: [0x61, 0x62, 0x63], rest: 0 })
    },
    // 3 is not a block type, `NLEN` is the complement of `LEN`, and the
    // checksum is the output's.
    checks: () => {
        assertEq(read([0x78, 0x9c, 0x07]), null)
        assertEq(read([0x78, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x61]), null)
        assertEq(read(abc.map((byte, i) => i === abc.length - 1 ? byte ^ 1 : byte)), null)
        assertEq(read(hello.map((byte, i) => i === hello.length - 1 ? byte ^ 1 : byte)), null)
        // a refusal after output was made is the refusal of the chunk that has it
        assertEq(read(abc.slice(0, 10), abc.slice(10, 13), [0, 0, 0, 0]), null)
    },
    // A dynamic block whose table description is no code is refused.
    badDescription: () => {
        // HLIT is 30, so there are 287 literal/length symbols
        assertEq(read([0x78, 0x01, ...bytes([1, ...field(2, 2), ...field(30, 5), ...field(0, 5), ...field(0, 4)])]), null)
    },
    // A copy can reach the start of the window: 32 768 back, over a stored block
    // before it and another copy after it that overlaps itself.
    farthest: () => {
        const before = Array.from({ length: 40_000 }, (_, i) => i * 37 + 11 & 0xff)
        const copied = before.slice(40_000 - 32_768, 40_000 - 32_768 + 258)
        const output = [...before, ...copied, 0x41, ...Array(10).fill(0x41), ...before.slice(-300, -300 + 3)]
        const storedPart = [0, before.length & 0xff, before.length >> 8, ~before.length & 0xff, ~before.length >> 8 & 0xff, ...before]
        const blocks = fixedBlock([[258, 32_768], 0x41, [10, 1], [3, 300 + 258 + 11]], true)
        const stream = [0x78, 0x01, ...storedPart, ...bytes(blocks), ...closing(output)]
        assertStructurallySame(read(stream), { output, rest: 0 })
        assertStructurallySame(read(...pieces(stream, 7_001)), { output, rest: 0 })
    },
    // Nothing to copy from, a symbol with a code and no meaning, and a distance
    // that names nothing.
    badSymbols: () => {
        const closed = (/** @type {readonly number[]} */ blocks) => [0x78, 0x01, ...bytes(blocks), 0, 0, 0, 0]
        // a copy at the start
        assertEq(read(closed(fixedBlock([[3, 1]], true))), null)
        // a copy past the start
        assertEq(read(closed(fixedBlock([1, 2, [3, 3]], true))), null)
        // length symbol 286, which the fixed code has and means nothing
        assertEq(read(closed([...field(1, 1), ...field(1, 2), ...fixedCode(286), ...fixedCode(256)])), null)
        // distance symbol 30, likewise, after a literal and a length
        assertEq(read(closed([...field(1, 1), ...field(1, 2), ...fixedCode(0), ...fixedCode(257), ...written('11110'), ...fixedCode(256)])), null)
    },
    throw: {
        // A `Vec` that is not whole bytes is no input.
        notBytes: () => append(vec(7n)(0x55n))(init),
    },
}
