/**
 * Functional building blocks for representing grammars in Backus–Naur Form (BNF).
 * The module provides helpers to model terminals, Sequences, Variants, and
 * repetition patterns as combinators for building new grammars from other
 * grammars. Symbols are stored as UTF-16 code points and terminal ranges are
 * packed into 48-bit numbers for compactness. To emit a serializable
 * representation, use the transformer in `bnf/data/module.f.ts`.
 *
 * @module
 */

import { codePointListToString, stringToCodePointList } from '../text/utf16/module.f.ts'
import { type Array2, isArray2 } from '../types/array/module.f.ts'
import { map, toArray, repeat as listRepeat } from '../types/list/module.f.ts'

// Types

/**
 * A range of symbols. Two 24-bit numbers are stored in one JS number (48 bits).
 *
 * For example: 0xBBBBBB_EEEEEE
 * - 0xBBBBBB is the first symbol (24 bits)
 * - 0xEEEEEE is the last symbol (24 bits)
 */
export type TerminalRange = number

/** Sequence: ordered collection of rules evaluated left-to-right. */
export type Sequence = readonly Rule[]

/** Variant: map of named choices keyed by their production names. */
export type Variant = {
    readonly[k in string]: Rule
}

/** Resolved rule representation (no laziness). */
export type DataRule = Variant | Sequence | TerminalRange | string

/** Function that returns a rule, used for recursive definitions. */
export type LazyRule = () => DataRule

/** Either a concrete rule or a thunk returning one. */
export type Rule = DataRule | LazyRule

// Internals:

const { fromEntries, values } = Object

const { fromCodePoint } = String

/**
 * Two 24 bit numbers can be fit into one JS number (53 bit).
 */
const offset = 24

const mask = (1 << offset) - 1

const isValid = (r: number): boolean => r >= 0 && r <= mask

/** Highest valid Unicode scalar value as a string. */
export const max: string = codePointListToString([0x10FFFF])

/**
 * Combine two 24-bit code points into a single {@link TerminalRange}.
 */
export const rangeEncode = (a: number, b: number): TerminalRange => {
    if (!isValid(a) || !isValid(b) || a > b) {
        throw `Invalid range ${a} ${b}.`
    }
    return (a << offset) | b
}

/** Encode a single code point into a {@link TerminalRange}. */
export const oneEncode = (a: number): TerminalRange => rangeEncode(a, a)

/** Split a packed {@link TerminalRange} into its start and end code points. */
export const rangeDecode = (r: number): Array2<number> =>
    [r >> offset, r & mask]

const mapOneEncode = map(oneEncode)

/** Convert a string into a sequence of single-character terminal ranges. */
export const toSequence = (s: string): readonly TerminalRange[] =>
    toArray(mapOneEncode(stringToCodePointList(s)))

/**
 * Normalize a string into a sequence, collapsing to a single range when
 * possible. Useful for concise inline definitions.
 */
export const str = (s: string): readonly TerminalRange[] | TerminalRange => {
    const x = toSequence(s)
    return x.length === 1 ? x[0] : x
}

const mapEntry = map((v: number) => [fromCodePoint(v), oneEncode(v)])

/**
 * Create a {@link RangeVariant} where each character in the string is a key
 * mapping to its own terminal range.
 */
export const set = (s: string): RangeVariant =>
    fromEntries(toArray(mapEntry(stringToCodePointList(s))))

/**
 * Encode a two-character string as a range from the first to the second code
 * point.
 */
export const range = (ab: string): TerminalRange => {
    const a = toArray(stringToCodePointList(ab))
    if (!isArray2(a)) {
        throw `Invalid range ${ab}.`
    }
    return rangeEncode(...a)
}

type RangeList = readonly TerminalRange[]

/** Variant map specialized for terminal ranges. */
export type RangeVariant = { readonly [k in string]: TerminalRange }

/**
 * Convert a {@link TerminalRange} back into its string identifier.
 * Single-character ranges produce a one-character string; wider ranges return
 * both bounds.
 */
export const rangeToId = (r: TerminalRange): string => {
    const ab = rangeDecode(r)
    const [a, b] = ab
    const cp = a === b ? [a] : ab
    return fromCodePoint(...cp)
}

const rangeToEntry = (r: TerminalRange): readonly [string, TerminalRange] =>
    [rangeToId(r), r]

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

/**
 * Remove each range in `removeSet` from `range`, returning the remaining
 * segments as a {@link RangeVariant}.
 */
export const remove = (range: TerminalRange, removeSet: RangeVariant): RangeVariant => {
    let result: RangeList = [range]
    for (const r of values(removeSet)) {
        result = removeOne(result, r)
    }
    return toVariantRangeSet(result)
}

//

export type None = readonly[]

export const none: None = []

export type Option<S> = {
    some: S
    none: None
}

/** Construct an {@link Option} from a rule. */
export const option = <S extends Rule>(some: S): Option<S> => ({
    some,
    none,
})

export type Repeat0Plus<T> = () => Option<readonly[T, Repeat0Plus<T>]>

/**
 * Repeat a rule zero or more times, represented as a lazy option.
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
 * Repeat a rule one or more times.
 */
export const repeat1Plus = <T extends Rule>(some: T): Repeat1Plus<T> =>
    [some, repeat0Plus(some)]

export type Join1Plus<T, S> = readonly[T, Repeat0Plus<readonly[S, T]>]

/**
 * Repeat a rule one or more times with a separator between items.
 */
export const join1Plus = <T extends Rule, S extends Rule>(some: T, separator: S): Join1Plus<T, S> =>
    [some, repeat0Plus([separator, some])]

export type Join0Plus<T, S> = Option<readonly[T, Repeat0Plus<readonly[S, T]>]>

/**
 * Repeat a rule zero or more times with a separator between items.
 */
export const join0Plus = <T extends Rule, S extends Rule>(some: T, separator: S): Rule =>
    option(join1Plus(some, separator))

export type Repeat<T> = readonly T[]

/**
 * Repeat a rule a fixed number of times, returning a concrete sequence.
 */
export const repeat = (n: number) => <T extends Rule>(some: T): Repeat<T> =>
    toArray(listRepeat(some)(n))

/**
 * Check whether a rule is empty or resolves to an empty rule.
 */
export const isEmpty = (rule: Rule): boolean => {
    const d = typeof rule === 'function' ? rule() : rule
    return d === '' || (d instanceof Array && d.length === 0)
}
