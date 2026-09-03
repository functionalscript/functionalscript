/**
 * Core BNF grammar primitives and helpers for describing parser rules.
 *
 * The module provides terminal-range encoding utilities, rule composition
 * types, and set/range helpers used by FunctionalScript grammar definitions.
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { FixedArray } from '../types/array/types.ts'
 * @import { TerminalRange, Sequence, Rule, RangeVariant, None, Option, Repeat0Plus, Repeat1Plus, Join1Plus } from './types.ts'
 */

import { codePointListToString, stringToCodePointList } from '../text/utf16/module.f.mjs'
import { definedValues } from '../types/object/module.f.mjs'
import { isFixedArray } from '../types/array/module.f.mjs'
import { map, toArray } from '../types/list/module.f.mjs'
import { contains } from '../types/range/module.f.mjs'
import { assert } from '../asserts/module.f.mjs'

// Internals:

const { fromEntries } = Object

const { fromCodePoint } = String

/**
 * Two 24 bit numbers can be fit into one JS number (53 bit).
 */
const offset = 24

const mask = (1 << offset) - 1

/**
 * How many stored endpoint codes one 24-bit half holds: `2 ** 24`.
 */
const terminalSize = mask + 1

/**
 * The logical end-of-input symbol.
 *
 * `-1` is outside the non-negative physical-symbol domain, so no alphabet
 * adapter can produce it and no ordinary symbol has to be reserved for it.
 * Parser backends synthesize it exactly once, after the physical input.
 */
export const eofSymbol = -1

/**
 * The largest ordinary symbol, `2 ** 24 - 2`: the semantic domain is
 * `[-1] | [0, 2 ** 24 - 2]`, exactly `2 ** 24` terminals, one per stored code.
 */
const maxSymbol = mask - 1

const isValid = contains(eofSymbol, maxSymbol)

/**
 * Semantic terminal to its stored 24-bit endpoint code. Branchless: EOF wraps
 * to `2 ** 24 - 1` (the top of the stored space) and every ordinary symbol
 * keeps its own value as its code.
 *
 * @type {(value: number) => number}
 */
const encodeTerminal = value => (value + terminalSize) & mask

/**
 * The inverse of `encodeTerminal`, also branchless.
 *
 * Stored codes are an implementation representation, not semantic terminal
 * ordering — `2 ** 24 - 1` is the largest code but the smallest terminal — so
 * range operations that care about ordering must compare decoded values.
 *
 * @type {(value: number) => number}
 */
const decodeTerminal = value => ((value + 1) & mask) - 1

/** @type {(a: number, b: number) => TerminalRange} */
export const rangeEncode = (a, b) => {
    assert(isValid(a) && isValid(b) && a <= b)
    return Number((BigInt(encodeTerminal(a)) << BigInt(offset)) | BigInt(encodeTerminal(b)))
}

/**
 * Encodes a single symbol as a {@link TerminalRange}.
 *
 * @type {(a: number) => TerminalRange}
 */
export const oneEncode = a => rangeEncode(a, a)

/**
 * End-of-file marker: the singleton range of {@link eofSymbol}. Deliberately
 * outside the ordinary symbol domain — and so outside Unicode — so it can
 * never collide with a real code point.
 *
 * @type {TerminalRange}
 */
export const eof = oneEncode(eofSymbol)

/**
 * Every ordinary symbol packed into a single {@link TerminalRange}. EOF is not
 * one of them, so complements over this range never include it.
 *
 * @type {TerminalRange}
 */
export const fullRange = rangeEncode(0, maxSymbol)

/**
 * Unicode scalar value range packed into a single {@link TerminalRange}.
 * @type {TerminalRange}
 */
export const unicodeRange = 0x000000_10FFFF

/**
 * Maximal Unicode code point encoded as a string value.
 */
export const unicodeMax = codePointListToString([0x10FFFF])

/**
 * Decodes a packed range into `[start, end]` semantic symbols.
 *
 * @type {(r: number) => FixedArray<2, number>}
 */
export const rangeDecode = r =>
    [decodeTerminal(Number(BigInt(r) >> BigInt(offset))), decodeTerminal(r & mask)]

const mapOneEncode = map(oneEncode)

/** @type {(s: string) => readonly TerminalRange[]} */
export const toSequence = s =>
    toArray(mapOneEncode(stringToCodePointList(s)))

/**
 * Converts the whole string into one rule:
 * - a single {@link TerminalRange} when the string has one symbol,
 * - a sequence of {@link TerminalRange} values when the string has multiple symbols.
 *
 * @type {(s: string) => readonly TerminalRange[] | TerminalRange}
 */
export const str = s => {
    const x = toSequence(s)
    return x.length === 1 ? x[0] : x
}

const mapEntry = map((/** @type {number} */ v) => [fromCodePoint(v), oneEncode(v)])

/**
 * Converts a string into a variant that maps each character to its symbol range.
 *
 * @type {(s: string) => RangeVariant}
 */
export const set = s =>
    fromEntries(toArray(mapEntry(stringToCodePointList(s))))

const isPair = isFixedArray(2)

/**
 * Encodes a two-symbol string into a terminal range.
 *
 * @throws If `ab` does not contain exactly two unicode code points.
 *
 * @type {(ab: string) => TerminalRange}
 */
export const range = ab => {
    const a = toArray(stringToCodePointList(ab))
    if (!isPair(a)) {
        throw `Invalid range ${ab}.`
    }
    return rangeEncode(...a)
}

/** @type {(r: TerminalRange) => readonly [string, TerminalRange]} */
const rangeToEntry = r =>
    ['0x' + r.toString(16), r]

/** @type {(r: readonly TerminalRange[]) => RangeVariant} */
const toVariantRangeSet = r =>
    fromEntries(r.map(rangeToEntry))

/** @type {(list: readonly TerminalRange[], ab: number) => readonly TerminalRange[]} */
const removeOne = (list, ab) => {
    const [a, b] = rangeDecode(ab)
    /** @type {readonly TerminalRange[]} */
    let result = []
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

/** @type {(range: TerminalRange, v: RangeVariant) => RangeVariant} */
export const remove = (range, v) => {
    /** @type {readonly TerminalRange[]} */
    let result = [range]
    for (const r of definedValues(v)) {
        result = removeOne(result, r)
    }
    return toVariantRangeSet(result)
}

/**
 * Returns the complement set of the provided ranges over {@link fullRange}.
 *
 * @type {(v: RangeVariant) => RangeVariant}
 */
export const not = v =>
    remove(fullRange, v)

/**
 * Returns the complement set of a character set over {@link fullRange}.
 *
 * @type {(s: string) => RangeVariant}
 */
export const notSet = s =>
    not(set(s))

/**
 * Shared empty sequence literal.
 *
 * @type {None}
 */
export const none = []

/**
 * Creates an option value from a required branch.
 */
export const option =
    /**
     * @template {Rule} const S
     * @param {S} some
     * @returns {Option<S>}
     */
    some => ({
        some,
        none,
    })

/**
 * Repeat zero or more times.
 *
 * https://english.stackexchange.com/questions/506480/single-word-quantifiers-for-zero-or-more-like-cardinalities
 * - zero or more - any, 0Plus
 * - one or more - several, 1Plus
 *
 * Also see: https://arbs.nzcer.org.nz/types-numbers
 */
export const repeat0Plus =
    /**
     * @template {Rule} T
     * @param {T} some
     * @returns {Repeat0Plus<T>}
     */
    some => {
        const r = () => option([some, r])
        return r
    }

/**
 * Repeat one or more times.
 */
export const repeat1Plus =
    /**
     * @template {Rule} T
     * @param {T} some
     * @returns {Repeat1Plus<T>}
     */
    some =>
        [some, repeat0Plus(some)]

/**
 * Repeats `some` one or more times separated by `separator`.
 */
export const join1Plus =
    /**
     * @template {Rule} T
     * @template {Rule} S
     * @param {T} some
     * @param {S} separator
     * @returns {Join1Plus<T, S>}
     */
    (some, separator) =>
        [some, repeat0Plus([separator, some])]

/**
 * Repeats `some` zero or more times separated by `separator`.
 */
export const join0Plus =
    /**
     * @template {Rule} T
     * @template {Rule} S
     * @param {T} some
     * @param {S} separator
     * @returns {Rule}
     */
    (some, separator) =>
        option(join1Plus(some, separator))

/**
 * A delimited, comma-separated list with whitespace between tokens:
 * `open ws (item ws (',' ws item ws)*)? close`.
 *
 * `ws` is the per-grammar whitespace rule and is curried so callers can
 * partially apply it once (`const cj = commaJoin0Plus(ws)`) before reusing
 * the same combinator at multiple bracket pairs. The two-character string
 * supplies the bracket pair via destructuring (e.g. `'[]'`, `'{}'`).
 *
 * @type {(ws: Rule) => (bracketPair: string, item: Rule) => Sequence}
 */
export const commaJoin0Plus = ws =>
    ([open, close], item) =>
        [open, ws, join0Plus([item, ws], [',', ws]), close]

/**
 * Determines whether the rule is an empty rule.
 *
 * @type {(rule: Rule) => boolean}
 */
export const isEmpty = rule => {
    const d = typeof rule === 'function' ? rule() : rule
    return d === '' || (d instanceof Array && d.length === 0)
}
