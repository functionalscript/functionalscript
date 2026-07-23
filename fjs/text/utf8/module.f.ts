/**
 * UTF-8 byte-level encoding and decoding utilities for FunctionalScript streams.
 *
 * @module
 */
import { flatMap, toArray, type List, type Thunk } from '../../types/list/module.f.ts'
import type { StateScan } from '../../types/function/operator/module.f.ts'
import type { Array1, Array2, Array3 } from '../../types/array/module.f.ts'
import { decoder, errorMask, isValidCodePoint } from '../code_point/module.f.ts'
import { msb, u8List, length, type Vec } from '../../types/bit_vec/module.f.ts'
import { codePointListToString } from '../utf16/module.f.ts'

/**
 * An unsigned 8-bit integer, represents a single byte.
 */
export type U8 = number

/**
 * A singed 32-bit integer.
 */
export type I32 = number

/**
 * Represents an unsigned 8-bit type - U8 or the end-of-file indicator.
 * The U8 represents the byte itself, and null indicates that reading does not return anything else.
 */
export type ByteOrEof = U8 | null

/**
 * Represents the state of a UTF-8 decoding operation that contains at least one byte.
 */
export type Utf8NonEmptyState =
    | Array1<number>
    | Array2<number>
    | Array3<number>

/**
 * Represents the state of a UTF-8 decoding operation, which can be either `null` (no state)
 * or a non-empty state containing one or more bytes.
 */
export type Utf8State = null | Utf8NonEmptyState

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

/**
 * Encodes the low six bits of `x` as a UTF-8 continuation byte.
 */
const contByte = (x: number) => x & contMask | contTag

/**
 * Reads the six payload bits of a continuation byte.
 */
const contPayload = (b: number) => b & contMask

/**
 * The valid lead-byte range for 2-, 3-, and 4-byte sequences (RFC 3629);
 * excludes overlong 2-byte leads (`C0`, `C1`) and leads above `U+10FFFF` (`F5`-`F7`).
 */
const leadMin = 0b1100_0010
const leadMax = 0b1111_0100
const isLeadByte = (b: number): boolean => b >= leadMin && b <= leadMax

/**
 * Dispatches a fresh-state byte, emitting `prefix` ahead of whatever the byte
 * itself produces. Shared by the `state === null` arm and by error recovery
 * after {@link utf8StateToError}, which differ only in `prefix`.
 */
const restart = (prefix: readonly I32[]) =>
    (byte: number): readonly [readonly I32[], Utf8State] =>
        byte < contTag ? [[...prefix, byte], null]
        : isLeadByte(byte) ? [[...prefix], [byte]]
        : [[...prefix, byte | errorMask], null]

/**
 * Converts a Unicode code point to a sequence of UTF-8 bytes.
 * @param input The Unicode code point to be converted. Valid range:
 *   - 0x0000 to 0x007F for 1-byte sequences.
 *   - 0x0080 to 0x07FF for 2-byte sequences.
 *   - 0x0800 to 0xFFFF for 3-byte sequences.
 *   - 0x10000 to 0x10FFFF for 4-byte sequences.
 * @returns A readonly array of UTF-8 bytes representing the input code point.
 *   - Returns `[errorMask]` if the input does not match valid UTF-8 encoding rules.
 */
const codePointToUtf8 = (input: number): readonly U8[] => {
    if (input >= 0x0000 && input <= 0x007f) {
        return [input & 0b01111_1111]
    }
    if (input >= 0x0080 && input <= 0x07ff) {
        return [input >> 6 | lead2Tag, contByte(input)]
    }
    if (input >= 0x0800 && input <= 0xffff) {
        return [
            input >> 12 | lead3Tag,
            contByte(input >> 6),
            contByte(input),
        ]
    }
    if (input >= 0x10000 && input <= 0x10ffff) {
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
 */
export const fromCodePointList: (input: List<number>) => Thunk<U8> = flatMap(
    codePointToUtf8,
)

/**
 * Converts a non-empty UTF-8 decoding state to an error code.
 *
 * @param state - A non-empty UTF-8 decoding state.
 * @returns An I32 error code derived from the invalid UTF-8 state.
 */
export const utf8StateToError = (state: Utf8NonEmptyState): I32 => {
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
 */
export const utf8ByteToCodePointOp: StateScan<number, Utf8State, readonly I32[]> = (byte, state) => {
    if (byte < 0x00 || byte > 0xff) {
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
 * Handles the end-of-file (EOF) case for UTF-8 decoding.
 *
 * @param state - The current UTF-8 decoding state.
 * @returns A tuple containing:
 *   - A list of decoded Unicode code points or error codes.
 *   - The reset UTF-8 state (`null`).
 */
export const utf8EofToCodePointOp = (
    state: Utf8State,
): readonly [List<I32>, Utf8State] => [
    state === null ? null : [utf8StateToError(state)],
    null,
]

/**
 * Converts a list of UTF-8 bytes into a list of Unicode code points.
 *
 * @param input - A list of UTF-8 bytes.
 * @returns A list of Unicode code points or error codes.
 */
export const toCodePointList: (input: List<U8>) => List<I32> =
    decoder(utf8ByteToCodePointOp, utf8EofToCodePointOp)

/**
 * Returns the decoded string if `v` is valid UTF-8, or `null` otherwise.
 * Rejects non-octet Vecs, invalid byte sequences, surrogates, and out-of-range
 * code points.
 */
export const fromVec = (v: Vec): string | null => {
    if ((length(v) & 0b111n) !== 0n) { return null }
    const arr = toArray(toCodePointList(u8List(msb)(v)))
    for (const cp of arr) {
        if (!isValidCodePoint(cp)) { return null }
    }
    return codePointListToString(arr)
}
