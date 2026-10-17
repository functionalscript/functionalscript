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
 * Stored blocks and the framing are here. A block of Huffman codes is not, and
 * is refused as malformed until it is.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Taken } from './private.ts'
 * @import { Output, State } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { isWholeBytes, u8ListMsb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { reverse, toArray } from '../../types/list/module.f.mjs'
import { append as adler, init as adlerInit } from '../adler32/module.f.mjs'

/** A stream not yet read. */
export const init = /** @type {State} */ ({
    phase: 'header',
    input: [],
    bit: 0,
    last: false,
    left: 0,
    adler: adlerInit,
})

/** A step that needs input there is not yet. */
const more = 'more'

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
 * The `n` bits at the front of the input, `n` at most 16, or `more` while the
 * input is shorter. DEFLATE reads each byte from its least significant bit, so
 * the bits are a little-endian number shifted by those already used.
 *
 * @type {(state: State, n: number) => number | typeof more}
 */
const bits = ({ input, bit }, n) => {
    const count = Math.ceil((bit + n) / 8)
    if (input.length < count) { return more }
    const word = input.slice(0, count).reduce((acc, byte, i) => acc | byte << 8 * i, 0)
    return word >> bit & (1 << n) - 1
}

/** @type {(state: State, n: number) => State} */
const skip = (state, n) => {
    const { input, bit } = state
    const total = bit + n
    return { ...state, input: input.slice(total >> 3), bit: total & 7 }
}

/** The big-endian number the first four bytes are, and the bytes after them. */
const word32 = (/** @type {readonly number[]} */ [a, b, c, d]) => ((a * 256 + b) * 256 + c) * 256 + d

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
            const opening = bits(state, 3)
            if (opening === more) { return more }
            // only the stored type, 0, is read so far; 3 is not a type at all
            return opening >> 1 === 0
                ? taken({ ...skip(state, 3), phase: 'lengths', last: (opening & 1) === 1 })
                : null
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
            const n = Math.min(left, input.length)
            const chunk = u8ListToVecMsb(input.slice(0, n))
            return {
                state: { ...state, input: input.slice(n), left: left - n, adler: adler(chunk)(state.adler) },
                chunk,
            }
        }
        case 'trailer': {
            if (input.length < 4) { return more }
            // the checksum of the output, most significant byte first
            return word32(input) === state.adler
                ? taken({ ...state, phase: 'done', input: input.slice(4) })
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
 * What follows the stream, once it has closed; `null` while it has not.
 *
 * @throws On more bytes than a `Vec` holds, which only a reader that keeps
 * feeding a stream that has ended brings on itself.
 *
 * @type {(state: State) => Nullable<Vec>}
 */
export const end = state => state.phase === 'done' ? u8ListToVecMsb(state.input) : null
