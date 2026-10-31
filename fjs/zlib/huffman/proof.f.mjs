import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { more } from '../bits/module.f.js'
import { assign, bytes, field, written } from '../testlib.f.mjs'
import { code, decode, dynamic, fixed, fixedDistances, fixedLiterals } from './module.f.js'

/** The extra bits of the repeats 16, 17 and 18. */
const widths = { 16: 2, 17: 3, 18: 7 }

/**
 * The bits of a dynamic block's description: the counts, the lengths of the
 * code-lengths code (`lengths`, by symbol), and the `body` it spells, each item
 * a symbol and the value of its extra bits where it has them.
 *
 * @type {(hlit: number, hdist: number, lengths: readonly number[], body: readonly (readonly [number, number?])[]) => readonly number[]}
 */
const description = (hlit, hdist, lengths, body) => {
    const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
    const count = Math.max(4, order.reduce((most, symbol, i) => lengths[symbol] !== 0 ? i + 1 : most, 0))
    const codes = assign(lengths)
    return [
        ...field(hlit, 5), ...field(hdist, 5), ...field(count - 4, 4),
        ...order.slice(0, count).flatMap(symbol => field(lengths[symbol], 3)),
        ...body.flatMap(([symbol, extra]) => [
            ...written(codes[symbol]),
            ...(extra === undefined ? [] : field(extra, widths[/** @type {16 | 17 | 18} */ (symbol)])),
        ]),
    ]
}

/** The lengths of a code-lengths code by symbol, from the few that have one. @type {(of: Readonly<Record<number, number>>) => readonly number[]} */
const lengthsOf = of => Array.from({ length: 19 }, (_, symbol) => of[symbol] ?? 0)

// A code-lengths code of the zero run 18 (one bit), a length 0 and a length 1
// (two bits each).
const runs = lengthsOf({ 18: 1, 0: 2, 1: 2 })

/** `n` zeros as the runs of 18 they take: 138 and what is left, which is at least 11. @type {(n: number) => readonly (readonly [number, number])[]} */
const zeros = n => n <= 138 ? [[18, n - 11]] : [[18, 127], ...zeros(n - 138)]

/** @type {(bits: readonly number[], pos?: number) => ReturnType<typeof dynamic>} */
const read = (bits, pos = 0) => dynamic(bytes(bits), pos)

export const proof = {
    // The lengths that make a code, in the order the symbols get codes.
    code: () => {
        assertStructurallySame(code([2, 1, 3, 3], true), {
            count: [0, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            symbol: [1, 0, 2, 3],
            incomplete: false,
        })
        assertEq(code([1, 1], true)?.incomplete, false)
        assertEq(code([], true)?.symbol.length, 0)
    },
    // More codes of a length than it has room for are no code.
    overSubscribed: () => {
        assertEq(code([1, 1, 1], true), null)
        assertEq(code([1, 1, 1], false), null)
        assertEq(code([1, 2, 2, 2], false), null)
    },
    // Fewer are no code either, except a lone one-bit code, and none at all.
    incomplete: () => {
        assertEq(code([2], false), null)
        assertEq(code([1, 2], false), null)
        assertEq(code([1], true), null)
        assertStructurallySame(code([1], false)?.symbol, [0])
        assertEq(code([1], false)?.incomplete, true)
        for (const complete of [true, false]) {
            assertEq(code([0, 0], complete)?.incomplete, true)
            assertEq(code([0, 0], complete)?.symbol.length, 0)
        }
    },
    // A symbol from its bits, the first bit the first of the code.
    decode: () => {
        const c = /** @type {import('./types.ts').Code} */ (code([2, 1, 3, 3], true))
        const input = bytes([...written('0'), ...written('10'), ...written('110'), ...written('111')])
        assertStructurallySame(decode(c, input, 0), [1, 1])
        assertStructurallySame(decode(c, input, 1), [0, 2])
        assertStructurallySame(decode(c, input, 3), [2, 3])
        assertStructurallySame(decode(c, input, 6), [3, 3])
        // the bits run out inside a code: the last bit of the input is a 1
        assertEq(decode(c, [0x80], 7), more)
        assertEq(decode(c, [], 0), more)
    },
    // The bits of a lone one-bit code are 0; a 1 is refused after the one bit,
    // not after fifteen, so an input that ends there is refused and not waited on.
    loneCode: () => {
        const c = /** @type {import('./types.ts').Code} */ (code([0, 1], false))
        assertStructurallySame(decode(c, bytes([0]), 0), [1, 1])
        assertEq(decode(c, bytes([1]), 0), null)
        assertEq(decode(c, [0x80], 7), null)
        const none = /** @type {import('./types.ts').Code} */ (code([], false))
        assertEq(decode(none, [0], 0), null)
        assertEq(decode(none, [], 0), more)
    },
    // The fixed codes, from the table in RFC 1951 section 3.2.6.
    fixed: () => {
        assertEq(fixed.literals, fixedLiterals)
        assertEq(fixed.distances, fixedDistances)
        for (const [text, symbol] of /** @type {const} */ ([
            ['00110000', 0], ['10111111', 143], ['110010000', 144], ['111111111', 255],
            ['0000000', 256], ['0010111', 279], ['11000000', 280], ['11000111', 287],
        ])) {
            assertStructurallySame(decode(fixedLiterals, bytes(written(text)), 0), [symbol, text.length], text)
        }
        for (const symbol of [0, 3, 29, 30, 31]) {
            assertStructurallySame(decode(fixedDistances, bytes(field(symbol, 5).toReversed()), 0), [symbol, 5], symbol)
        }
    },
    // A description of a dynamic block: an end-of-block and a lone distance
    // code, 258 lengths spelled by runs of zeros, the one length 1, and a zero.
    dynamic: () => {
        const bits = description(0, 0, runs, [...zeros(256), [1], [0]])
        const result = read(bits)
        assertEq(result === more || result === null, false)
        const [codes, end] = /** @type {readonly [import('./types.ts').Codes, number]} */ (result)
        assertEq(end, bits.length)
        assertStructurallySame(codes.literals.symbol, [256])
        assertEq(codes.literals.incomplete, true)
        assertEq(codes.distances.symbol.length, 0)
        // from a position that is not a byte's start
        assertStructurallySame(read([1, 0, 1, ...bits], 3), [codes, end + 3])
    },
    // The repeats: 16 for the length before it, 17 for a short run of zeros, and
    // 18 for a long one; a code of four 2-bit codes at the end, 253 to 256.
    repeats: () => {
        const lengths = lengthsOf({ 16: 2, 2: 2, 0: 2, 18: 3, 17: 3 })
        const body = /** @type {const} */ ([[18, 127], [18, 97], [17, 4], [2], [16, 0], [0]])
        const result = read(description(0, 0, lengths, body))
        assertEq(result === more || result === null, false)
        const [codes] = /** @type {readonly [import('./types.ts').Codes, number]} */ (result)
        assertStructurallySame(codes.literals.symbol, [253, 254, 255, 256])
        assertEq(codes.literals.incomplete, false)
        // and every prefix waits, a repeat's extra bits included
        const bits = description(0, 0, lengths, body)
        for (let length = 0; length < Math.ceil(bits.length / 8); length += 1) {
            assertEq(dynamic(bytes(bits).slice(0, length), 0), more, length)
        }
    },
    // A description zlib refuses: too many symbols, a code-lengths code that is
    // no code, a repeat of a length there is none of or past the end, no
    // end-of-block, and a code over-subscribed.
    refused: () => {
        const full = lengthsOf(Object.fromEntries(Array.from({ length: 19 }, (_, symbol) => [symbol, 1])))
        const repeatFirst = lengthsOf({ 16: 1, 0: 1 })
        for (const bits of [
            description(30, 0, runs, []),
            description(0, 30, runs, []),
            description(0, 0, full, []),
            description(0, 0, lengthsOf({ 18: 1 }), []),
            description(0, 0, repeatFirst, [[16, 0]]),
            description(0, 0, runs, [[18, 127], [18, 127]]),
            description(0, 0, runs, [[18, 127], [18, 109]]),
            description(0, 0, lengthsOf({ 0: 1, 1: 1 }), Array(258).fill([1])),
            description(0, 2, runs, [...zeros(256), [1], [1], [1], [1]]),
        ]) {
            assertEq(read(bits), null)
        }
    },
    // A code-lengths code with no symbol reads a zero length from each bit, so
    // the lengths are all zero and there is no end-of-block; until there is
    // input for them all, it waits.
    emptyLengthsCode: () => {
        const header = description(0, 0, lengthsOf({}), [])
        assertEq(read([...header, ...Array(258).fill(0)]), null)
        assertEq(read([...header, ...Array(100).fill(0)]), more)
    },
    // Every proper prefix of a description waits for more input.
    prefixes: () => {
        const bits = description(0, 0, runs, [...zeros(256), [1], [0]])
        for (let length = 0; length < Math.ceil(bits.length / 8); length += 1) {
            assertEq(dynamic(bytes(bits).slice(0, length), 0), more, length)
        }
    },
}
