/**
 * Inflates a zlib stream (RFC 1950) holding DEFLATE data (RFC 1951), fed as
 * chunks, in the shape of a hash: `init`, `append` of a chunk of input, `end`.
 * The design, and why a chunk is a `Vec`, is
 * [`todo/inflate.md`](../../../todo/inflate.md).
 *
 * `append` gives the output a chunk makes and the next state, or `null` for a
 * stream that is malformed, so a refusal comes with the chunk that carries the
 * bad byte, and the output of the chunks before it has been given already. `end` gives the bytes after the
 * stream, once it has closed, or `null` while it has not: a reader that was
 * handed more than the stream is handed back the rest, which is why a window
 * need not end where the stream does.
 *
 * The framing and all three kinds of block are here: stored, fixed Huffman and
 * dynamic Huffman. Every step takes the input it has and no more, so a chunk
 * that ends anywhere — inside a block's opening, a table description or a
 * symbol — leaves the state where it was and waits.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Item, Taken } from './private.ts'
 * @import { Output, State } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { isWholeBytes, u8ListMsb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { reverse, toArray } from '../../types/list/module.f.mjs'
import { appendBytes as adler, init as adlerInit } from '../adler32/module.f.mjs'
import { more, read } from '../bits/module.f.mjs'
import { decode, dynamic, fixed } from '../huffman/module.f.mjs'
import { copy, empty as emptyWindow, last as lastOf, push, pushAll } from '../window/module.f.mjs'

/** A stream not yet read. */
export const init = /** @type {State} */ ({
    phase: 'header',
    input: [],
    bit: 0,
    last: false,
    left: 0,
    adler: adlerInit,
    window: emptyWindow,
    codes: null,
})

/** @type {(state: State) => Taken} */
const taken = state => ({ state, chunk: null })

/**
 * The bytes of `input` a position in it has passed or started, which is what
 * an alignment to a byte boundary drops.
 *
 * @type {(input: readonly number[], bit: number) => readonly number[]}
 */
const aligned = (input, bit) => input.slice(Math.ceil(bit / 8))

/**
 * The state with `pos` bits of its input used, counted from the start of it.
 *
 * @type {(state: State, pos: number) => State}
 */
const at = (state, pos) => ({ ...state, input: state.input.slice(pos >> 3), bit: pos & 7 })

/** The big-endian number the first four bytes are. */
const word32 = (/** @type {readonly number[]} */ [a, b, c, d]) => ((a * 256 + b) * 256 + c) * 256 + d

/** The base length and the extra bits of the length symbols 257 to 285. */
const lengthCodes = /** @type {const} */ ([
    [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 1], [13, 1],
    [15, 1], [17, 1], [19, 2], [23, 2], [27, 2], [31, 2], [35, 3], [43, 3], [51, 3],
    [59, 3], [67, 4], [83, 4], [99, 4], [115, 4], [131, 5], [163, 5], [195, 5],
    [227, 5], [258, 0],
])

/** The base distance and the extra bits of the distance symbols 0 to 29. */
const distanceCodes = /** @type {const} */ ([
    [1, 0], [2, 0], [3, 0], [4, 0], [5, 1], [7, 1], [9, 2], [13, 2], [17, 3], [25, 3],
    [33, 4], [49, 4], [65, 5], [97, 5], [129, 6], [193, 6], [257, 7], [385, 7],
    [513, 8], [769, 8], [1025, 9], [1537, 9], [2049, 10], [3073, 10], [4097, 11],
    [6145, 11], [8193, 12], [12289, 12], [16385, 13], [24577, 13],
])

/**
 * How many bytes a step of codes makes before it gives them: a step is a chunk
 * of output, which a `Vec` holds, and what the window can give back whole.
 */
const stepLimit = 0x4000

/**
 * The step that ends at `window` and bit `pos` of the input: the state there,
 * and the bytes made since `state` as a chunk, if any.
 *
 * @type {(state: State, window: State['window'], pos: number) => Taken}
 */
const made = (state, window, pos) => {
    const bytes = lastOf(window, window.length - state.window.length)
    return {
        state: { ...at(state, pos), window, adler: adler(bytes)(state.adler) },
        chunk: bytes.length === 0 ? null : u8ListToVecMsb(bytes),
    }
}

/**
 * The next symbol of a block of codes, and what it makes: a literal, a copy
 * from the window, or the end of the block. {@link more} while the input is
 * shorter than the symbol and what follows it, and `null` for a symbol that is
 * no code, a length or distance that is not one, or a copy from before the
 * start.
 *
 * @type {(codes: NonNullable<State['codes']>, input: readonly number[], pos: number, window: State['window']) => Item | typeof more | null}
 */
const item = ({ literals, distances }, input, pos, window) => {
    const symbol = decode(literals, input, pos)
    if (symbol === more || symbol === null) { return symbol }
    const [value, taken] = symbol
    const next = pos + taken
    if (value < 256) { return { window: push(window, value), pos: next, end: false } }
    if (value === 256) { return { window, pos: next, end: true } }
    // 286 and 287 have codes in the fixed block and mean nothing
    if (value > 285) { return null }
    const [base, width] = lengthCodes[value - 257]
    const extra = read(input, next, width)
    if (extra === more) { return more }
    const far = decode(distances, input, next + width)
    if (far === more || far === null) { return far }
    // 30 and 31 have codes in the fixed block and mean nothing
    if (far[0] > 29) { return null }
    const [distanceBase, distanceWidth] = distanceCodes[far[0]]
    const distanceExtra = read(input, next + width + far[1], distanceWidth)
    if (distanceExtra === more) { return more }
    const distance = distanceBase + distanceExtra
    return distance > window.length
        ? null
        : { window: copy(window, distance, base + extra), pos: next + width + far[1] + distanceWidth, end: false }
}

/**
 * The symbols of a block of codes that the input carries, up to the end of the
 * block or as many as a step makes.
 *
 * @type {(state: State, codes: NonNullable<State['codes']>) => Nullable<Taken | typeof more>}
 */
const symbols = (state, codes) => {
    const { input, last } = state
    let pos = state.bit
    let window = state.window
    let end = false
    while (!end && window.length - state.window.length < stepLimit) {
        const next = item(codes, input, pos, window)
        if (next === null) { return null }
        if (next === more) { break }
        ;({ window, pos, end } = next)
    }
    if (!end && pos === state.bit) { return more }
    const taken = made(state, window, pos)
    return end
        ? { ...taken, state: { ...taken.state, phase: last ? 'trailer' : 'block', codes: null } }
        : taken
}

/**
 * One step of the stream: the state after it and any output, `more` while the
 * input does not carry it, or `null` where the stream is malformed.
 *
 * @type {(state: State) => Nullable<Taken | typeof more>}
 */
const step = state => {
    const { phase, input, left, last } = state
    switch (phase) {
        case 'header': {
            if (input.length < 2) { return more }
            const [cmf, flg] = input
            // a multiple of 31, the deflate method, a window of at most 32 KiB
            // and no preset dictionary, which this has none to offer
            const ok = (cmf * 256 + flg) % 31 === 0 && (cmf & 0xf) === 8 && cmf >> 4 < 8 && (flg & 0x20) === 0
            return ok ? taken({ ...state, phase: 'block', input: input.slice(2) }) : null
        }
        case 'block': {
            const opening = read(input, state.bit, 3)
            if (opening === more) { return more }
            const next = { ...at(state, state.bit + 3), last: (opening & 1) === 1 }
            switch (opening >> 1) {
                case 0: { return taken({ ...next, phase: 'lengths' }) }
                case 1: { return taken({ ...next, phase: 'codes', codes: fixed }) }
                case 2: { return taken({ ...next, phase: 'dynamic' }) }
                // 3 is not a type
                default: { return null }
            }
        }
        case 'lengths': {
            const rest = aligned(input, state.bit)
            if (rest.length < 4) { return more }
            const [a, b, c, d] = rest
            const len = a | b << 8
            // `NLEN` is the complement of `LEN`
            return (len ^ (c | d << 8)) === 0xffff
                ? taken({ ...state, phase: 'stored', input: rest.slice(4), bit: 0, left: len })
                : null
        }
        case 'stored': {
            if (left === 0) { return taken({ ...state, phase: last ? 'trailer' : 'block' }) }
            if (input.length === 0) { return more }
            const bytes = input.slice(0, Math.min(left, input.length))
            return {
                state: {
                    ...state,
                    input: input.slice(bytes.length),
                    left: left - bytes.length,
                    adler: adler(bytes)(state.adler),
                    window: pushAll(state.window, bytes),
                },
                chunk: u8ListToVecMsb(bytes),
            }
        }
        case 'dynamic': {
            const description = dynamic(input, state.bit)
            if (description === more || description === null) { return description }
            const [codes, pos] = description
            return taken({ ...at(state, pos), phase: 'codes', codes })
        }
        case 'codes': { return symbols(state, /** @type {NonNullable<State['codes']>} */ (state.codes)) }
        case 'trailer': {
            // the last block can end anywhere in a byte; the checksum starts at the next
            const rest = aligned(input, state.bit)
            if (rest.length < 4) { return more }
            // the checksum of the output, most significant byte first
            return word32(rest) === state.adler
                ? taken({ ...state, phase: 'done', input: rest.slice(4), bit: 0, window: emptyWindow })
                : null
        }
        case 'done': { return more }
    }
}

/**
 * Reads a chunk of the stream: the state after it and the output it made, or
 * `null` for a stream that is malformed. Bytes that arrive after the stream has
 * closed are kept for {@link end}.
 *
 * @throws On a `v` that is not whole bytes.
 *
 * @type {(v: Vec) => (state: State) => Nullable<Output>}
 */
export const append = v => state => {
    assert(isWholeBytes(v), 'a zlib stream is bytes')
    /** @type {State} */
    let current = { ...state, input: [...state.input, ...toArray(u8ListMsb(v))] }
    // the chunks made, newest first: a list is how an accumulator that does not
    // copy what it has is built without mutating it
    /** @type {List<Vec>} */
    let made = null
    while (true) {
        const result = step(current)
        if (result === null) { return null }
        if (result === more) { return { state: current, output: toArray(reverse(made)) } }
        current = result.state
        if (result.chunk !== null) { made = { first: result.chunk, tail: made } }
    }
}

/**
 * How many bytes follow the stream, once it has closed; `null` while it has not.
 * A count, not the bytes: a reader that keeps feeding a stream that has ended
 * can bring any number of them, more than a `Vec` holds.
 *
 * @type {(state: State) => Nullable<number>}
 */
export const end = state => state.phase === 'done' ? state.input.length : null
