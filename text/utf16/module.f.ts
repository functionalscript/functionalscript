import {
    map,
    flat,
    stateScan,
    reduce,
    flatMap,
    empty,
    type List,
    type Result,
    type Thunk,
} from '../../types/list/module.f.ts'
import { concat, type StateScan } from '../../types/function/operator/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
import { fn } from '../../types/function/module.f.ts'

/**
 * Optional UTF16 type - represent an unsigned UTF16 integer or null.
 */
type WordOrEof = U16 | null

/**
 * Optional Utf16State - represents the state of utf16 decoding operation or null.
 * - number is used an unsigned integer.
 */
type Utf16State = number | null

/**
 * Represent an unsigned UTF16, used to store one word UTF-16 (code unit).
 */
export type U16 = number

/**
 * [0, 0x10_FFFF]: 16+5 = 21 bits
 *
 * 121_0000_0000: 16+16+9 = 41 bits
 */

/**
 * Represent an Unicode code point.
 * Has range: from 0x0000 to 0x10_FFFF (21 bits).
 */
export type CodePoint = number

/**
 * Ranges of code points for the lower (Low) and higher (High) parts of the BMP (Basic Multilingual Plane) plane.
 */
const lowBmp = contains([0x0000, 0xd7ff])
const highBmp = contains([0xe000, 0xffff])

/**
 * Checks whether the code point is in the BMP range.
 * BMP is the main multi-plane Unicode plane that covers code points 0x0000 - 0xFFFF, except for the range of surrogates.
 */
const isBmpCodePoint = (codePoint: CodePoint) =>
    lowBmp(codePoint) || highBmp(codePoint)

/**
 * Checks whether the 16-bit word (U16) is a surrogate of the high part.
 * Range: 0xD800 - 0xDBFF.
 */
const isHighSurrogate = contains([0xd800, 0xdbff])

/**
 * Checks whether the 16-bit word (U16) is a substitute for the low part.
 * Range: 0xDC00 – 0xDFFF.
 */
const isLowSurrogate = contains([0xdc00, 0xdfff])

/**
 * Mask of mistakes. Used to indicate invalid code points or coding errors
 */
const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/**
 * Checks whether the code point belongs to the additional (Supplementary) plane of Unicode.
 * Additional planes include code points from 0x010000 to 0x10FFFF.
 */
const isSupplementaryPlane = contains([0x01_0000, 0x10_ffff])


/**
 * Converts a Unicode code point to its corresponding UTF-16 representation.
 *
 * This function handles:
 * 1. Code points in the Basic Multilingual Plane (BMP) [0x0000–0xFFFF],
 *    which map directly to a single 16-bit value (U16).
 * 2. Supplementary Plane code points [0x10000–0x10FFFF],
 *    which are represented as surrogate pairs in UTF-16.
 *
 * @param codePoint - A valid Unicode code point.
 * @returns A list of 16-bit unsigned integers (U16) representing the UTF-16 encoding
 *          of the input code point. If the code point is in the BMP range, a single U16
 *          value is returned. For code points in the supplementary planes, two U16
 *          values (a high and a low surrogate) are returned.
 * @example
 *
 * ```ts
 * const exampleCodePoints: List<CodePoint> = [
 *     0x0041,       // 'A' (BMP, single U16)
 *     0x1F600,      // 😀 (Emoji, supplementary plane, surrogate pair)
 *     0xD7FF,       // Last code point in the low BMP range
 *     0xE000,       // First code point in the high BMP range
 *     0x10FFFF,     // Maximum valid code point in Unicode
 *     0x110000,     // Invalid code point (outside Unicode range)
 * ]
 * exampleCodePoints.forEach((codePoint) => {
 *     const utf16Result = codePointToUtf16(codePoint)
 *     console.log(`Code Point: U+${codePoint.toString(16).toUpperCase()}`)
 *     console.log(`UTF-16: ${utf16Result.map(u16 => u16.toString(16).toUpperCase()).join(' ')}`)
 * })
 * ```
 */
const codePointToUtf16 = (codePoint: CodePoint): List<U16> => {
    if (isBmpCodePoint(codePoint)) { return [codePoint] }
    if (isSupplementaryPlane(codePoint)) {
        const n = codePoint - 0x1_0000
        const high = (n >> 10) + 0xd800
        const low = (n & 0b0011_1111_1111) + 0xdc00
        return [high, low]
    }
    return [codePoint & 0xffff]
}


/**
 * Converts a UTF-16 sequence to its corresponding Unicode code points.
 *
 * This function handles:
 * 1. Single U16 values in the Basic Multilingual Plane (BMP) [0x0000–0xFFFF].
 * 2. Surrogate pairs representing code points in the Supplementary Plane [0x10000–0x10FFFF].
 * 3. Invalid input sequences by applying an error mask to the resulting code point.
 *
 * @param utf16 - A list of UTF-16 code units (U16) to convert.
 * @returns A list of Unicode code points. Each code point corresponds to one or more U16
 *          values in the input. Invalid sequences are marked with the `errorMask`.
 * @example
 *
 * ```ts
 * const exampleUtf16: List<U16> = [
 *     0x0041,       // 'A' (BMP, single U16)
 *     0xD83D, 0xDE00, // 😀 (Emoji, surrogate pair)
 *     0xD800,       // Unpaired high surrogate
 *     0xDC00,       // Unpaired low surrogate
 * ]
 *
 * const codePoints = toCodePointList(exampleUtf16)
 * codePoints.forEach((codePoint) => {
 *     if (codePoint & errorMask) {
 *         console.log(`Invalid sequence detected: ${codePoint.toString(16).toUpperCase()}`)
 *     } else {
 *         console.log(`Code Point: U+${codePoint.toString(16).toUpperCase()}`)
 *     }
 * })
 * ```
 */
export const fromCodePointList: (input: List<CodePoint>) => Thunk<U16>
    = flatMap(codePointToUtf16)

/**
 * Validates whether a given 16-bit unsigned integer (U16) falls within the valid range for UTF-16 code units.
 *
 * UTF-16 uses 16-bit code units to encode characters. The valid range for these code units is [0x0000, 0xFFFF].
 * This function is used to verify that a number is within this range.
 *
 * @param i - A 16-bit unsigned integer (U16) to validate.
 * @returns A boolean value indicating whether the input is a valid UTF-16 code unit.
 *
 * @example
 *
 * ```ts
 * const validU16 = u16(0x0041)  // true: U+0041 ('A')
 * const invalidU16 = u16(0x110000)  // false: Value is outside the valid range
 * const edgeCaseLow = u16(0x0000)  // true: Minimum valid value for UTF-16
 * const edgeCaseHigh = u16(0xFFFF)  // true: Maximum valid value for UTF-16
 * ```
 */
const u16: (i: U16) => boolean = contains([0x0000, 0xFFFF])


/**
 * A stateful operation that converts a UTF-16 word (U16) to a list of Unicode code points (CodePoint),
 * while maintaining the state of surrogate pair decoding.
 *
 * This operation processes UTF-16 code units and decodes them into Unicode code points. It handles:
 * 1. BMP code points (single U16).
 * 2. Surrogate pairs (two U16s representing a single code point in the supplementary planes).
 * 3. Invalid or malformed code units.
 *
 * It also manages the internal state, which is necessary to handle surrogate pairs. If the state is null,
 * it expects a valid BMP code point or a high surrogate. If the state is not null, it processes a low surrogate
 * and combines the pair into a single supplementary code point.
 *
 * @param state - The current state of the UTF-16 decoding operation.
 *               This can be either `null` (no state) or the previous high surrogate value.
 * @param word - The current UTF-16 word (U16) to process.
 * @returns A tuple where the first element is a list of decoded Unicode code points (`CodePoint`), and
 *          the second element is the updated state. If the word is invalid, an error code `0xffffffff` is returned.
 *
 * @example
 *
 * ```ts
 * const state: Utf16State = null;
 * const word: U16 = 0xD83D;  // High surrogate for 😀 emoji
 * const [decodedCodePoints, newState] = utf16ByteToCodePointOp(state)(word);
 * ```
 *
 * @example
 *
 * ```ts
 * const state: Utf16State = 0xD83D;  // High surrogate already stored
 * const word: U16 = 0xDC00;  // Low surrogate for 😀 emoji
 * const [decodedCodePoints, newState] = utf16ByteToCodePointOp(state)(word);
 * ```
 */
const utf16ByteToCodePointOp: StateScan<U16, Utf16State, List<CodePoint>>
    = state => word => {
        if (!u16(word)) {
            return [[0xffffffff], state]
        }
        if (state === null) {
            if (isBmpCodePoint(word)) { return [[word], null] }
            if (isHighSurrogate(word)) { return [[], word] }
            return [[word | errorMask], null]
        }
        if (isLowSurrogate(word)) {
            const high = state - 0xd800
            const low = word - 0xdc00
            return [[(high << 10) + low + 0x10000], null]
        }
        if (isBmpCodePoint(word)) { return [[state | errorMask, word], null] }
        if (isHighSurrogate(word)) { return [[state | errorMask], word] }
        return [[state | errorMask, word | errorMask], null]
    }


/**
 * Handles the EOF (end-of-file) condition during UTF-16 decoding.
 *
 * If there is no pending state (`state === null`), it simply returns an empty list
 * of code points, indicating no further input to process. If there is a pending state,
 * it is treated as an unpaired surrogate, and the `errorMask` is applied to flag
 * the invalid sequence.
 *
 * @param state - The current UTF-16 decoding state. This can be:
 *   - `null`: No pending surrogate to process.
 *   - A high surrogate (0xD800–0xDBFF) left from an earlier input, waiting for a low surrogate.
 * @returns A tuple:
 *   - The first element is a list of code points. If there’s a pending state, it is returned
 *     with the `errorMask` applied.
 *   - The second element is the next state, which will always be `null` because EOF means no
 *     further processing.
 *
 * @example
 *
 * ```js
 * const eofState = utf16EofToCodePointOp(0xD800) // Unpaired high surrogate
 * const validState = utf16EofToCodePointOp(null) // No pending state
 * ```
 */
const utf16EofToCodePointOp = (state: Utf16State): readonly[List<CodePoint>, Utf16State] =>
    [state === null ? empty : [state | errorMask],  null]


/**
 * A stateful scan operation that processes UTF-16 input (word or EOF).
 * This function determines whether to handle a UTF-16 word or an end-of-file (EOF)
 * signal during decoding:
 * 1. If the input is `null` (EOF), it calls `utf16EofToCodePointOp` to process
 *    any remaining state.
 * 2. If the input is a valid UTF-16 word, it calls `utf16ByteToCodePointOp` to
 *    process the word and update the state accordingly.
 * @param state - The current state in the UTF-16 decoding process:
 *   - `null`: No pending surrogate.
 *   - A high surrogate waiting for a low surrogate.
 * @param input - The current UTF-16 word to process, or `null` to signal EOF.
 * @returns A tuple:
 *   - A list of decoded code points (if any).
 *   - The updated decoding state.
 *
 * @example
 *
 * ```ts
 * // Example 1: Process a valid UTF-16 word
 * const input1 = 0x0041 // 'A' (BMP code point)
 * const result1 = utf16ByteOrEofToCodePointOp(null)(input1)
 * console.log(result1) // [[0x0041], null]
 * // Example 2: Process a high surrogate, followed by EOF
 * const input2 = 0xD83D // High surrogate
 * const result2 = utf16ByteOrEofToCodePointOp(null)(input2)
 * console.log(result2) // [[], 0xD83D] (waiting for a low surrogate)
 * const eofResult = utf16ByteOrEofToCodePointOp(0xD83D)(null)
 * console.log(eofResult) // [[0xD83D | errorMask], null] (unpaired high surrogate)
 * // Example 3: Handle EOF with no pending state
 * const eofResult2 = utf16ByteOrEofToCodePointOp(null)(null)
 * ```
 */
const utf16ByteOrEofToCodePointOp: StateScan<WordOrEof, Utf16State, List<CodePoint>>
    = state => input => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)


/**
 * Represents an end-of-file (EOF) indicator in a list of UTF-16 code units.
 *
 * This list contains a single element, `null`, which is used to signal the end
 * of input during UTF-16 decoding operations.
 * @example
 *
 * ```ts
 * const input = [...utf16Data, ...eofList]
 * // Ensures the EOF is handled during processing.
 * ```
 */
const eofList: List<WordOrEof> = [null]


/**
 * Converts a list of UTF-16 code units to a list of Unicode code points (CodePoint).
 * This function processes each UTF-16 code unit, decoding them into their corresponding Unicode code points.
 * The input list of `U16` values may represent characters in the Basic Multilingual Plane (BMP) or supplementary planes,
 * with surrogate pairs handled correctly. The function also handles EOF (`null`).
 * @param input - A list of UTF-16 code units (`U16`), possibly containing surrogate pairs.
 * @returns A list of Unicode code points (`CodePoint`), one for each valid code unit or surrogate pair.
 *
 * @example
 *
 * ```ts
 * const utf16List: List<U16> = [0x0041, 0xD83D, 0xDE00] // 'A' and 😀 (surrogate pair)
 * const codePoints = toCodePointList(utf16List)
 * ```
 */
export const toCodePointList = (input: List<U16>): List<CodePoint> =>
    flat(stateScan(utf16ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

/**
 * Converts a string to a list of UTF-16 code units (U16).
 *
 * This function processes each character in the input string and converts it to its corresponding UTF-16 code unit(s).
 * Characters in the Basic Multilingual Plane (BMP) will produce a single `U16`, while supplementary plane characters
 * (those requiring surrogate pairs) will produce two `U16` values.
 * @param s - The input string to convert to UTF-16 code units.
 * @returns A list of UTF-16 code units (`U16`) representing the string.
 *
 * @example
 *
 * ```js
 * const inputString = "Hello, 😀"
 * const utf16List = stringToList(inputString)
 * ```
 */
export const stringToList = (s: string): List<U16> => {
    const at = (i: number): Result<number> => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

/**
 * Converts a string to a list of Unicode code points (CodePoint).
 * This function first converts the string to a list of UTF-16 code units (U16) using `stringToList`,
 * then it converts the UTF-16 code units to Unicode code points using `toCodePointList`. This is useful for handling
 * Unicode characters, including supplementary characters represented by surrogate pairs in UTF-16.
 *
 * @param input - The input string to convert.
 * @returns A list of Unicode code points (`CodePoint`) corresponding to the characters in the string.
 *
 * @example
 *
 * ```js
 * const inputString = "Hello, 😀"
 * const codePoints = stringToCodePointList(inputString)
 * ```
 */
export const stringToCodePointList = (input: string): List<CodePoint> =>
    toCodePointList(stringToList(input))

/**
 * Converts a list of UTF-16 code units (U16) to a string.
 * This function takes a list of `U16` values (UTF-16 code units) and reconstructs the original string by mapping
 * each code unit back to its character using `String.fromCharCode`. The resulting characters are concatenated
 * to form the final string.
 *
 * @param input - A list of UTF-16 code units (`U16`).
 * @returns A string representing the characters encoded by the input UTF-16 code units.
 *
 * @example
 *
 * ```ts
 * const utf16List: List<U16> = [0x0041, 0x0042, 0x0043] // 'ABC'
 * const outputString = listToString(utf16List)
 * ```
 */
export const listToString: (input: List<U16>) => string
    = fn(map(String.fromCharCode))
        .map(reduce(concat)(''))
        .result

/**
 * Converts a list of Unicode code points (CodePoint) to a string.
 * This function first converts the list of Unicode code points to a list of UTF-16 code units using `fromCodePointList`,
 * then it uses `listToString` to reconstruct the string from the UTF-16 code units.
 *
 * @param input - A list of Unicode code points (`CodePoint`).
 * @returns A string representing the characters encoded by the input code points.
 *
 * @example
 *
 * ```ts
 * const codePoints: List<CodePoint> = [0x48, 0x65, 0x6C, 0x6C, 0x6F]
 * const outputString = codePointListToString(codePoints)
 * ```
 */
export const codePointListToString = (input: List<CodePoint>): string =>
    listToString(fromCodePointList(input))
