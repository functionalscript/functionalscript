/**
 * Shared Unicode code-point contract for the UTF-8 and UTF-16 decoders: the
 * error-tag mask used to flag invalid sequences, the streaming `decoder`
 * factory that wraps a per-unit step and an end-of-input step into a single
 * `List`-to-`List` conversion, and the code-point classification predicates
 * (BMP / surrogate / supplementary-plane / overall validity) that both codecs
 * share.
 *
 * @module
 */
import { flat, type List, stateScan } from '../../types/list/module.f.ts'
import type { StateScan } from '../../types/function/operator/module.f.ts'
import { contains } from '../../types/range/module.f.ts'

/**
 * Error mask used to tag invalid code points or encoding errors. A decoded
 * value with this bit set represents a malformed unit rather than a valid
 * code point.
 */
export const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/**
 * Builds a streaming decoder from the two direction-specific steps.
 *
 * Decoding starts from the empty (`null`) state. The input is processed unit by
 * unit through `byteOp`, then a trailing end-of-input marker drives `eofOp` to
 * flush any leftover decoding state.
 *
 * @param byteOp - The per-unit decoding step.
 * @param eofOp - The end-of-input step that flushes the remaining state.
 * @returns A function converting a list of code units into a list of code points.
 */
export const decoder = <Unit, S, Cp>(
    byteOp: StateScan<Unit, S | null, List<Cp>>,
    eofOp: (state: S | null) => readonly [List<Cp>, S | null],
): (input: List<Unit>) => List<Cp> => {
    const op: StateScan<Unit | null, S | null, List<Cp>> = (input, state) =>
        input === null ? eofOp(state) : byteOp(input, state)
    const run = stateScan(op)(null)
    return input => flat(run(flat<Unit | null>([input, [null]])))
}

/**
 * Unicode code-point classification boundaries. The surrogate block
 * (`0xD800`–`0xDFFF`) splits into a high half (`0xD800`–`0xDBFF`) and a low half
 * (`0xDC00`–`0xDFFF`); the BMP ends at `0xFFFF` and `maxCodePoint` (`0x10FFFF`)
 * is the largest assignable code point. Every predicate below is derived from
 * these constants so the surrogate bounds and the maximum appear exactly once.
 */
const surrogateMin = 0xd800 as const
const lowSurrogateMin = 0xdc00 as const
const surrogateMax = 0xdfff as const
const bmpMax = 0xffff as const
const maxCodePoint = 0x10_ffff as const

/**
 * Checks whether the 16-bit word (U16) is a high surrogate.
 * Range: 0xD800 - 0xDBFF.
 */
export const isHighSurrogate = contains([surrogateMin, lowSurrogateMin - 1])

/**
 * Checks whether the 16-bit word (U16) is a low surrogate.
 * Range: 0xDC00 - 0xDFFF.
 */
export const isLowSurrogate = contains([lowSurrogateMin, surrogateMax])

/**
 * Ranges of code points for the lower (Low) and higher (High) parts of the BMP
 * (Basic Multilingual Plane), i.e. the BMP with the surrogate block removed.
 */
const lowBmp = contains([0x0000, surrogateMin - 1])
const highBmp = contains([surrogateMax + 1, bmpMax])

/**
 * Checks whether the code point is in the BMP range.
 * BMP is the main Unicode plane that covers code points 0x0000 - 0xFFFF, except
 * for the range of surrogates.
 */
export const isBmpCodePoint = (codePoint: number): boolean =>
    lowBmp(codePoint) || highBmp(codePoint)

/**
 * Checks whether the code point belongs to a supplementary (additional) Unicode
 * plane. Supplementary planes cover code points from 0x010000 to 0x10FFFF.
 */
export const isSupplementaryPlane = contains([bmpMax + 1, maxCodePoint])

/**
 * The full assignable code-point range and the surrogate block, used to gate
 * overall validity below.
 */
const validRange = contains([0, maxCodePoint])
const isSurrogate = contains([surrogateMin, surrogateMax])

/**
 * Checks whether the code point is a valid scalar value: within the assignable
 * Unicode range (0x0000 - 0x10FFFF) and not a surrogate.
 */
export const isValidCodePoint = (c: number): boolean =>
    validRange(c) && !isSurrogate(c)

/**
 * The control-character blocks and the whitespace exception used to separate
 * *text* code points from binary control bytes. C0 controls span 0x0000 -
 * 0x001F; 0x007F (DEL) and the C1 controls (0x0080 - 0x009F) form one
 * contiguous run; the whitespace block 0x0009 - 0x000D (TAB, LF, VT, FF, CR) is
 * the only control range legitimate in text.
 */
const c0Control = contains([0x00, 0x1f])
const delAndC1Control = contains([0x7f, 0x9f])
const textWhitespace = contains([0x09, 0x0d])

/**
 * Checks whether the code point is a *text* code point — distinct from
 * {@link isValidCodePoint}, which gates well-formedness for decoding. A code
 * point is text unless it is a control character: the controls are 0x0000 -
 * 0x001F, 0x007F (DEL), and 0x0080 - 0x009F (C1), minus the whitespace block
 * 0x0009 - 0x000D (TAB, LF, VT, FF, CR), which is legitimate in text. Every
 * code point at or above 0x0020 that is not DEL or a C1 control is text.
 */
export const isTextCodePoint = (c: number): boolean =>
    textWhitespace(c) || !(c0Control(c) || delAndC1Control(c))
