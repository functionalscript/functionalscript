/**
 * Core BNF grammar primitives and helpers for describing parser rules.
 *
 * The module provides terminal-range encoding utilities, rule composition
 * types, and set/range helpers used by FunctionalScript grammar definitions.
 *
 * @module
 */
import { codePointListToString, stringToCodePointList } from '../text/utf16/module.f.ts'
import { definedValues, type StringMap } from '../types/object/module.f.ts'
import { type Array2, isArray2 } from '../types/array/module.f.ts'
import { map, toArray, repeat as listRepeat } from '../types/list/module.f.ts'
import { contains } from '../types/range/module.f.ts'
import { assert } from '../asserts/module.f.ts'

// Types

/**
 * A range of symbols. Two 24-bit numbers are stored in one JS number (48 bits).
 *
 * For example: 0xBBBBBB_EEEEEE
 * - 0xBBBBBB is the first symbol (24 bits)
 * - 0xEEEEEE is the last symbol (24 bits)
 *
 * 24 bits per half, not 26 (the most `float64`'s 52-bit safe-integer mantissa
 * could fit two of): 24 is divisible by 4, so each half is exactly 6 hex
 * digits, and the packed pair reads as a plain `0xYYYYYY_ZZZZZZ` literal with
 * no partial hex digit at either boundary. 26 bits would still be safe to
 * store but wouldn't align to hex nibbles, making the packed literal harder
 * to read and split by eye.
 *
 * Not 16 bits (32 bits total) either, even though a 32-bit pair would fit in
 * a JS bitwise operator's native 32-bit range (JS `|`/`&`/`<<`/etc. operate on
 * 32-bit ints, whereas the 48-bit pair used here, and even a 52-bit one,
 * would need converting to `BigInt` for bitwise operations). 16 bits per
 * symbol can't hold a full Unicode code point: the max scalar value `0x10FFFF`
 * needs 21 bits, well past `0xFFFF`. So the bitwise-op convenience of 16 loses
 * to the requirement of representing every Unicode code point in one half.
 */
export type TerminalRange = number

/**
 * Full 24-bit symbol range packed into a single {@link TerminalRange}.
 */
export const fullRange: TerminalRange = 0x000000_FFFFFF

/**
 * Unicode scalar value range packed into a single {@link TerminalRange}.
 */
export const unicodeRange: TerminalRange = 0x000000_10FFFF

/**
 * Maximal Unicode code point encoded as a string value.
 */
export const unicodeMax: string = codePointListToString([0x10FFFF])

/** A sequence of rules. */
export type Sequence = readonly Rule[]

/** A variant */
export type Variant = { readonly[k in string]?: Rule }

/**
 * Data-only grammar rule.
 */
export type DataRule = Variant | Sequence | TerminalRange | string

/**
 * Lazily evaluated grammar rule.
 */
export type LazyRule = () => DataRule

/**
 * Grammar rule, either immediate data or lazy rule factory.
 */
export type Rule = DataRule | LazyRule

// Internals:

const { fromEntries } = Object

const { fromCodePoint } = String

/**
 * Two 24 bit numbers can be fit into one JS number (53 bit).
 */
const offset = 24

const mask = (1 << offset) - 1

const isValid = contains(0, mask)

export const rangeEncode = (a: number, b: number): TerminalRange => {
    assert(isValid(a) && isValid(b) && a <= b)
    return Number((BigInt(a) << BigInt(offset)) | BigInt(b))
}

/**
 * Encodes a single symbol as a {@link TerminalRange}.
 */
export const oneEncode = (a: number): TerminalRange => rangeEncode(a, a)

/**
 * End-of-file marker: `mask`, the single largest value the 24-bit symbol
 * space can hold (the top of `fullRange`). Deliberately outside Unicode
 * (`unicodeRange` tops out at `0x10FFFF`) so it can never collide with a
 * real code point; see `fs/bnf/todo/token-symbol-encoding.md` for the free
 * range this leaves for synthetic (non-code-point) token symbols.
 */
export const eof: TerminalRange = oneEncode(mask)

/**
 * Decodes a packed range into `[start, end]` symbols.
 */
export const rangeDecode = (r: number): Array2<number> =>
    [Number(BigInt(r) >> BigInt(offset)), r & mask]

const mapOneEncode = map(oneEncode)

export const toSequence = (s: string): readonly TerminalRange[] =>
    toArray(mapOneEncode(stringToCodePointList(s)))

/**
 * Converts the whole string into one rule:
 * - a single {@link TerminalRange} when the string has one symbol,
 * - a sequence of {@link TerminalRange} values when the string has multiple symbols.
 */
export const str = (s: string): readonly TerminalRange[] | TerminalRange => {
    const x = toSequence(s)
    return x.length === 1 ? x[0] : x
}

const mapEntry = map((v: number) => [fromCodePoint(v), oneEncode(v)])

/**
 * Converts a string into a variant that maps each character to its symbol range.
 */
export const set = (s: string): RangeVariant =>
    fromEntries(toArray(mapEntry(stringToCodePointList(s))))

/**
 * Encodes a two-symbol string into a terminal range.
 *
 * @throws If `ab` does not contain exactly two unicode code points.
 */
export const range = (ab: string): TerminalRange => {
    const a = toArray(stringToCodePointList(ab))
    if (!isArray2(a)) {
        throw `Invalid range ${ab}.`
    }
    return rangeEncode(...a)
}

type RangeList = readonly TerminalRange[]

/**
 * A set of terminal ranges compatible with the `Variant` rule.
 */
export type RangeVariant = StringMap<string, TerminalRange>

const rangeToEntry = (r: TerminalRange): readonly [string, TerminalRange] =>
    ['0x' + r.toString(16), r]

const toVariantRangeSet = (r: RangeList): RangeVariant =>
    fromEntries(r.map(rangeToEntry))

const removeOne = (list: RangeList, ab: number): RangeList => {
    const [a, b] = rangeDecode(ab)
    let result: RangeList = []
    for (const ab0 of list) {
        const [a0, b0] = rangeDecode(ab0)
        if (a0 < a) {
            // [a0
            //     ]a
            result = [...result, rangeEncode(a0, Math.min(b0, a - 1))]
        }
        if (b < b0) {
            //    b0]
            // b[
            result = [...result, rangeEncode(Math.max(b + 1, a0), b0)]
        }
    }
    return result
}

export const remove = (range: TerminalRange, v: RangeVariant): RangeVariant => {
    let result: RangeList = [range]
    for (const r of definedValues(v)) {
        result = removeOne(result, r)
    }
    return toVariantRangeSet(result)
}

/**
 * Returns the complement set of the provided ranges over {@link fullRange}.
 */
export const not = (v: RangeVariant): RangeVariant =>
    remove(fullRange, v)

/**
 * Returns the complement set of a character set over {@link fullRange}.
 */
export const notSet = (s: string): RangeVariant =>
    not(set(s))

/**
 * Empty sequence type for optional grammar branches.
 */
export type None = readonly[]

/**
 * Shared empty sequence literal.
 */
export const none: None = []

/**
 * Optional grammar branch.
 */
export type Option<S> = {
    some: S
    none: None
}

/**
 * Creates an option value from a required branch.
 */
export const option = <S extends Rule>(some: S): Option<S> => ({
    some,
    none,
})

export type Repeat0Plus<T> = () => Option<readonly[T, Repeat0Plus<T>]>

/**
 * Repeat zero or more times.
 *
 * https://english.stackexchange.com/questions/506480/single-word-quantifiers-for-zero-or-more-like-cardinalities
 * - zero or more - any, 0Plus
 * - one or more - several, 1Plus
 *
 * Also see: https://arbs.nzcer.org.nz/types-numbers
 */
export const repeat0Plus = <T extends Rule>(some: T): Repeat0Plus<T> => {
    const r = () => option([some, r] as const)
    return r
}

export type Repeat1Plus<T> = readonly[T, Repeat0Plus<T>]

/**
 * Repeat one or more times.
 */
export const repeat1Plus = <T extends Rule>(some: T): Repeat1Plus<T> =>
    [some, repeat0Plus(some)]

export type Join1Plus<T, S> = readonly[T, Repeat0Plus<readonly[S, T]>]

/**
 * Repeats `some` one or more times separated by `separator`.
 */
export const join1Plus = <T extends Rule, S extends Rule>(some: T, separator: S): Join1Plus<T, S> =>
    [some, repeat0Plus([separator, some])]

export type Join0Plus<T, S> = Option<readonly[T, Repeat0Plus<readonly[S, T]>]>

/**
 * Repeats `some` zero or more times separated by `separator`.
 */
export const join0Plus = <T extends Rule, S extends Rule>(some: T, separator: S): Rule =>
    option(join1Plus(some, separator))

/**
 * A delimited, comma-separated list with whitespace between tokens:
 * `open ws (item ws (',' ws item ws)*)? close`.
 *
 * `ws` is the per-grammar whitespace rule and is curried so callers can
 * partially apply it once (`const cj = commaJoin0Plus(ws)`) before reusing
 * the same combinator at multiple bracket pairs. The two-character string
 * supplies the bracket pair via destructuring (e.g. `'[]'`, `'{}'`).
 */
export const commaJoin0Plus = (ws: Rule) =>
    ([open, close]: string, item: Rule): Sequence =>
        [open, ws, join0Plus([item, ws], [',', ws]), close]

export type Repeat<T> = readonly T[]

/**
 * Repeats a rule a fixed number of times.
 */
export const repeat = (n: number) => <T extends Rule>(some: T): Repeat<T> =>
    toArray(listRepeat(some)(n))

/**
 * Determines whether the rule is an empty rule.
 */
export const isEmpty = (rule: Rule): boolean => {
    const d = typeof rule === 'function' ? rule() : rule
    return d === '' || (d instanceof Array && d.length === 0)
}
