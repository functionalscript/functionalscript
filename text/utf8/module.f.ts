import { flat, flatMap, type List, stateScan, type Thunk } from '../../types/list/module.f.ts'
import type { StateScan } from '../../types/function/operator/module.f.ts'
import type { Array1, Array2, Array3 } from '../../types/array/module.f.ts'

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
 * Error mask constant used to represent invalid code points or encoding errors in UTF-8.
 */
const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

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
        return [input >> 6 | 0b1100_0000, input & 0b0011_1111 | 0b1000_0000]
    }
    if (input >= 0x0800 && input <= 0xffff) {
        return [
            input >> 12 | 0b1110_0000,
            input >> 6 & 0b0011_1111 | 0b1000_0000,
            input & 0b0011_1111 | 0b1000_0000,
        ]
    }
    if (input >= 0x10000 && input <= 0x10ffff) {
        return [
            input >> 18 | 0b1111_0000,
            input >> 12 & 0b0011_1111 | 0b1000_0000,
            input >> 6 & 0b0011_1111 | 0b1000_0000,
            input & 0b0011_1111 | 0b1000_0000,
        ]
    }
    if ((input & errorMask) !== 0) {
        if ((input & 0b1000_0000_0000_0000) !== 0) {
            return [
                input >> 12 & 0b0000_0111 | 0b1111_0000,
                input >> 6 & 0b0011_1111 | 0b1000_0000,
                input & 0b0011_1111 | 0b1000_0000,
            ]
        }
        if ((input & 0b0000_0100_0000_0000) !== 0) {
            return [
                input >> 6 & 0b0000_1111 | 0b1110_0000,
                input & 0b0011_1111 | 0b1000_0000,
            ]
        }
        if ((input & 0b0000_0010_0000_0000) !== 0) {
            return [
                input >> 6 & 0b0000_0111 | 0b1111_0000,
                input & 0b0011_1111 | 0b1000_0000,
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
const utf8StateToError = (state: Utf8NonEmptyState): I32 => {
    let x
    switch (state.length) {
        case 1: {
            [x] = state
            break
        }
        case 2: {
            const [s0, s1] = state
            x = s0 < 0b1111_0000
                ? ((s0 & 0b0000_1111) << 6) + (s1 & 0b0011_1111) + 0b0000_0100_0000_0000
                : ((s0 & 0b0000_0111) << 6) + (s1 & 0b0011_1111) +
                    0b0000_0010_0000_0000
            break
        }
        case 3: {
            const [s0, s1, s2] = state
            x = ((s0 & 0b0000_0111) << 12) + ((s1 & 0b0011_1111) << 6) +
                (s2 & 0b0011_1111) + 0b1000_0000_0000_0000
            break
        }
        default:
            throw 'invalid state'
    }
    return x | errorMask
}

/**
 * Decodes a byte into a Unicode code point, using a given UTF-8 state.
 *
 * @param state - The current UTF-8 decoding state.
 * @param byte - A single byte to decode.
 * @returns A tuple containing:
 *   - A list of decoded Unicode code points or error codes.
 *   - The updated UTF-8 state.
 */
const utf8ByteToCodePointOp: StateScan<number, Utf8State, List<I32>> = (state) => (byte) => {
    if (byte < 0x00 || byte > 0xff) {
        return [[errorMask], state]
    }
    if (state === null) {
        if (byte < 0b1000_0000) return [[byte], null]
        if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[], [byte]]
        return [[byte | errorMask], null]
    }
    if (byte >= 0b1000_0000 && byte < 0b1100_0000) {
        switch (state.length) {
            case 1: {
                const [s0] = state
                if (s0 < 0b1110_0000) {
                    return [[((s0 & 0b0001_1111) << 6) + (byte & 0b0011_1111)], null]
                }
                if (s0 < 0b1111_1000) return [[], [s0, byte]]
                break
            }
            case 2: {
                const [s0, s1] = state
                if (s0 < 0b1111_0000) {
                    return [[
                        ((s0 & 0b0000_1111) << 12) + ((s1 & 0b0011_1111) << 6) +
                        (byte & 0b0011_1111),
                    ], null]
                }
                if (s0 < 0b1111_1000) return [[], [s0, s1, byte]]
                break
            }
            case 3: {
                const [s0, s1, s2] = state
                return [[
                    ((s0 & 0b0000_0111) << 18) + ((s1 & 0b0011_1111) << 12) +
                    ((s2 & 0b0011_1111) << 6) + (byte & 0b0011_1111),
                ], null]
            }
        }
    }
    const error = utf8StateToError(state)
    if (byte < 0b1000_0000) return [[error, byte], null]
    if (byte >= 0b1100_0010 && byte <= 0b1111_0100) return [[error], [byte]]
    return [[error, byte | errorMask], null]
}

/**
 * Handles the end-of-file (EOF) case for UTF-8 decoding.
 *
 * @param state - The current UTF-8 decoding state.
 * @returns A tuple containing:
 *   - A list of decoded Unicode code points or error codes.
 *   - The reset UTF-8 state (`null`).
 */
const utf8EofToCodePointOp = (
    state: Utf8State,
): readonly [List<I32>, Utf8State] => [
    state === null ? null : [utf8StateToError(state)],
    null,
]

/**
 * Combines UTF-8 byte and EOF handling into a single decoding operation.
 *
 * @param state - The current UTF-8 decoding state.
 * @param input - The next byte or EOF indicator.
 * @returns A tuple containing:
 *   - A list of decoded Unicode code points or error codes.
 *   - The updated UTF-8 state.
 */
const utf8ByteOrEofToCodePointOp: StateScan<ByteOrEof, Utf8State, List<I32>> = (state) => (input) =>
    input === null ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

/**
 * A constant representing the end-of-file (EOF) marker for UTF-8 decoding.
 *
 * @remarks
 * This is used as a sentinel value in decoding operations to signify the
 * termination of input. The list contains a single `null` value, which
 * represents the EOF condition.
 */
const eofList: readonly ByteOrEof[] = [null]

/**
 * Converts a list of UTF-8 bytes into a list of Unicode code points.
 *
 * @param input - A list of UTF-8 bytes.
 * @returns A list of Unicode code points or error codes.
 */
export const toCodePointList: (input: List<U8>) => List<I32> = (input) =>
    flat(stateScan(utf8ByteOrEofToCodePointOp)(null)(flat([input, eofList])))
