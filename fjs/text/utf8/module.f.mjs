/**
 * UTF-8 byte-level encoding and decoding utilities for FunctionalScript streams.
 *
 * @module
 *
 * @import { List, Thunk } from '../../types/list/types.ts'
 * @import { StateScan } from '../../types/function/operator/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { ByteOrEof, I32, U8, Utf8NonEmptyState, Utf8State, } from './types.ts'
 */

import { flatMap, toArray } from '../../types/list/module.f.mjs'
import {
    bmpMax,
    decoder,
    eofFlush,
    errorMask,
    isSupplementaryPlane,
    isValidCodePoint,
} from '../code_point/module.f.mjs'
import { msb, u8List, length } from '../../types/bit_vec/module.f.mjs'
import { contains } from '../../types/range/module.f.mjs'
import { codePointListToString } from '../utf16/module.f.mjs'

/**
 * UTF-8 byte-format constants. Each byte kind is defined by a tag — the fixed
 * high bits identifying the kind — and a payload mask selecting the code-point
 * bits the byte carries. The encoder and the decoder are exact inverses, so
 * both read their bit patterns from this single set of definitions:
 *
 * | byte kind   | pattern      | tag       | payload mask |
 * |-------------|--------------|-----------|--------------|
 * | continuation| `10xx_xxxx`  | `contTag` | `contMask`   |
 * | 2-byte lead | `110x_xxxx`  | `lead2Tag`| `lead2Mask`  |
 * | 3-byte lead | `1110_xxxx`  | `lead3Tag`| `lead3Mask`  |
 * | 4-byte lead | `1111_0xxx`  | `lead4Tag`| `lead4Mask`  |
 */
const contTag = 0b1000_0000
const contMask = 0b0011_1111
const lead2Tag = 0b1100_0000
const lead2Mask = 0b0001_1111
const lead3Tag = 0b1110_0000
const lead3Mask = 0b0000_1111
const lead4Tag = 0b1111_0000
const lead4Mask = 0b0000_0111

const isInU8Range = contains(0x00, 0xff)

/**
 * Whether `i` is a byte this decoder can be handed.
 *
 * `U8` is just `number`, so neither half is redundant. The dispatch below
 * partitions only the *integers* in `0x00`–`0xff` — below `contTag`, a
 * continuation, or one of the leads, with no gap — so a fraction falls between
 * two of those and would be misclassified rather than rejected: emitted as a
 * code point when it is below `contTag`, tagged with a fractional payload when
 * it is not. Worse where the payload arithmetic reaches it, since the bitwise
 * operators truncate silently: a fractional continuation byte would decode to
 * the very code point its integer part spells, reporting nothing. And
 * `Number.isInteger` catches `NaN`, which compares false against both bounds
 * and so passes a range check on its own.
 *
 * This mirrors `u16` in `../utf16/module.f.mjs`, which carries the same check
 * for the same reason; the two differ only in their bounds.
 *
 * @type {(i: number) => boolean}
 */
const u8 = i => Number.isInteger(i) && isInU8Range(i)

/**
 * Encodes the low six bits of `x` as a UTF-8 continuation byte.
 *
 * @type {(x: number) => number}
 */
const contByte = x => x & contMask | contTag

/**
 * Reads the six payload bits of a continuation byte.
 *
 * @type {(b: number) => number}
 */
const contPayload = b => b & contMask

/**
 * The valid lead-byte range for 2-, 3-, and 4-byte sequences (RFC 3629);
 * excludes overlong 2-byte leads (`C0`, `C1`) and leads above `U+10FFFF` (`F5`-`F7`).
 */
const leadMin = 0b1100_0010
const leadMax = 0b1111_0100
/** @type {(b: number) => boolean} */
const isLeadByte = b => b >= leadMin && b <= leadMax

/**
 * Dispatches a fresh-state byte, emitting `prefix` ahead of whatever the byte
 * itself produces. Shared by the `state === null` arm and by error recovery
 * after {@link utf8StateToError}, which differ only in `prefix`.
 *
 * @type {(prefix: readonly I32[]) => (byte: number) => readonly [readonly I32[], Utf8State]}
 */
const restart = prefix =>
    byte =>
        byte < contTag ? [[...prefix, byte], null]
        : isLeadByte(byte) ? [[...prefix], [byte]]
        : [[...prefix, byte | errorMask], null]

/**
 * Converts a Unicode code point to a sequence of UTF-8 bytes.
 * @param {number} input The Unicode code point to be converted. Valid range:
 *   - 0x0000 to 0x007F for 1-byte sequences.
 *   - 0x0080 to 0x07FF for 2-byte sequences.
 *   - 0x0800 to 0xFFFF for 3-byte sequences.
 *   - 0x10000 to 0x10FFFF for 4-byte sequences.
 * @returns {readonly U8[]} A readonly array of UTF-8 bytes representing the input code point.
 *   - Returns `[errorMask]` if the input does not match valid UTF-8 encoding rules.
 */
const codePointToUtf8 = input => {
    if (input >= 0x0000 && input <= 0x007f) {
        return [input & 0b01111_1111]
    }
    if (input >= 0x0080 && input <= 0x07ff) {
        return [input >> 6 | lead2Tag, contByte(input)]
    }
    if (input >= 0x0800 && input <= bmpMax) {
        return [
            input >> 12 | lead3Tag,
            contByte(input >> 6),
            contByte(input),
        ]
    }
    if (isSupplementaryPlane(input)) {
        return [
            input >> 18 | lead4Tag,
            contByte(input >> 12),
            contByte(input >> 6),
            contByte(input),
        ]
    }
    if ((input & errorMask) !== 0) {
        if ((input & 0b1000_0000_0000_0000) !== 0) {
            return [
                input >> 12 & lead4Mask | lead4Tag,
                contByte(input >> 6),
                contByte(input),
            ]
        }
        if ((input & 0b0000_0100_0000_0000) !== 0) {
            return [
                input >> 6 & lead3Mask | lead3Tag,
                contByte(input),
            ]
        }
        if ((input & 0b0000_0010_0000_0000) !== 0) {
            return [
                input >> 6 & lead4Mask | lead4Tag,
                contByte(input),
            ]
        }
        if ((input & 0b0000_0000_1000_0000) !== 0) return [input & 0b1111_1111]
    }
    return [errorMask]
}

/**
 * Maps a list of Unicode code points to a stream of UTF-8 bytes.
 *
 * @param input - A list of Unicode code points to be converted.
 * @returns A thunk that lazily produces a sequence of UTF-8 bytes.
 *
 * @type {(input: List<number>) => Thunk<U8>}
 */
export const fromCodePointList = flatMap(
    codePointToUtf8,
)

/**
 * Converts a non-empty UTF-8 decoding state to an error code.
 *
 * @param {Utf8NonEmptyState} state A non-empty UTF-8 decoding state.
 * @returns {I32} An I32 error code derived from the invalid UTF-8 state.
 */
export const utf8StateToError = state => {
    let x
    switch (state.length) {
        case 1: {
            [x] = state
            break
        }
        case 2: {
            const [s0, s1] = state
            x = s0 < lead4Tag
                ? ((s0 & lead3Mask) << 6) + contPayload(s1) + 0b0000_0100_0000_0000
                : ((s0 & lead4Mask) << 6) + contPayload(s1) +
                    0b0000_0010_0000_0000
            break
        }
        case 3: {
            const [s0, s1, s2] = state
            x = ((s0 & lead4Mask) << 12) + (contPayload(s1) << 6) +
                contPayload(s2) + 0b1000_0000_0000_0000
            break
        }
        //default:
        //    throw 'invalid state'
    }
    return x | errorMask
}

/**
 * Decodes a byte into a Unicode code point, using a given UTF-8 state.
 *
 * Rejects overlong 3-/4-byte encodings (Unicode Table 3-7): a lead `E0` must
 * be followed by a continuation `>= 0xA0`, and a lead `F0` by a continuation
 * `>= 0x90`. It does not itself reject surrogates (`ED A0..BF`) or code
 * points above `U+10FFFF` (`F4 90..BF`); {@link fromVec}'s
 * `isValidCodePoint` pass filters those out of the raw code-point stream.
 *
 * @param state - The current UTF-8 decoding state.
 * @param byte - A single byte to decode.
 * @returns A tuple containing:
 *   - A list of decoded Unicode code points or error codes.
 *   - The updated UTF-8 state.
 *
 * @type {StateScan<number, Utf8State, readonly I32[]>}
 */
export const utf8ByteToCodePointOp = (byte, state) => {
    if (!u8(byte)) {
        return [[errorMask], state]
    }
    if (state === null) return restart([])(byte)
    if (byte >= contTag && byte < lead2Tag) {
        switch (state.length) {
            case 1: {
                const [s0] = state
                if (s0 < lead3Tag) {
                    return [[((s0 & lead2Mask) << 6) + contPayload(byte)], null]
                }
                if (s0 < 0b1111_1000) {
                    // Reject overlong 3-/4-byte encodings: after lead `E0` the
                    // first continuation must be >= 0xA0, after lead `F0` it
                    // must be >= 0x90 (Unicode Table 3-7).
                    const overlong = s0 === lead3Tag && byte < 0b1010_0000 ||
                        s0 === lead4Tag && byte < 0b1001_0000
                    if (!overlong) return [[], [s0, byte]]
                }
                break
            }
            case 2: {
                const [s0, s1] = state
                if (s0 < lead4Tag) {
                    return [[
                        ((s0 & lead3Mask) << 12) + (contPayload(s1) << 6) +
                        contPayload(byte),
                    ], null]
                }
                if (s0 < 0b1111_1000) return [[], [s0, s1, byte]]
                break
            }
            case 3: {
                const [s0, s1, s2] = state
                return [[
                    ((s0 & lead4Mask) << 18) + (contPayload(s1) << 12) +
                    (contPayload(s2) << 6) + contPayload(byte),
                ], null]
            }
        }
    }
    return restart([utf8StateToError(state)])(byte)
}

/**
 * Handles the end-of-file (EOF) case for UTF-8 decoding: a leftover incomplete
 * sequence is flushed as a single error code and the state resets to `null`.
 * The flush itself is `eofFlush` from `code_point`, shared with UTF-16.
 *
 * @type {(state: Utf8State) => readonly [List<I32>, Utf8State]}
 */
export const utf8EofToCodePointOp = eofFlush(utf8StateToError)

/**
 * Converts a list of UTF-8 bytes into a list of Unicode code points.
 *
 * @param input - A list of UTF-8 bytes.
 * @returns A list of Unicode code points or error codes.
 *
 * @type {(input: List<U8>) => List<I32>}
 */
export const toCodePointList =
    decoder(utf8ByteToCodePointOp, utf8EofToCodePointOp)

/**
 * Returns the decoded string if `v` is valid UTF-8, or `null` otherwise.
 * Rejects non-octet Vecs, invalid byte sequences, surrogates, and out-of-range
 * code points.
 *
 * @type {(v: Vec) => string | null}
 */
export const fromVec = v => {
    if ((length(v) & 0b111n) !== 0n) { return null }
    const arr = toArray(toCodePointList(u8List(msb)(v)))
    for (const cp of arr) {
        if (!isValidCodePoint(cp)) { return null }
    }
    return codePointListToString(arr)
}
