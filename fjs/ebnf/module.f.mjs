/**
 * The rule vocabulary an EBNF grammar is written in.
 *
 * A terminal is a set of symbols, and a set is a **value** — a `RangeSet`,
 * whose algebra is `types/range_set`'s `union`, `intersection`, `difference`
 * and `complement`, not a second set of combinators here. `oneOf` is the one
 * door a value comes through to become a rule, so a grammar writes
 * `oneOf(range('09'))` and composes with the value operations before that
 * point. A raw set is never a rule: `RangeSet` is `readonly number[]`, which is
 * a `Tuple` of bare-number rules, so `[48, 58]` would read as the two symbols
 * `0` and `:` in a row. `oneOf` is what says otherwise. Mind the two names: the
 * `Set` type is the terminal *rule*, and what `range`, `set` and the algebra
 * hand back is a `RangeSet` *value*.
 *
 * The helpers that build a set from symbols are the ones that know a symbol is
 * an integer, which is what the `+ 1` in a half-open boundary pair is: the
 * closed range `a..b` is `[a, b + 1]`, and `types/range_set`, where boundaries
 * are only ever compared, never adds one. **Ordinary symbols are the
 * non-negative safe integers**: `Number.MAX_SAFE_INTEGER` is the top one, and
 * because the boundary above it is not safe, its range is spelled by the open
 * tail `[a]` rather than by a pair.
 *
 * Every rule constructor returns a thunk, so a grammar can name a rule before
 * the rule is defined and recursion terminates at the reference.
 *
 * @module
 *
 * @import { RangeSet } from '../types/range_set/types.ts'
 * @import { Set, Rule, Infinity, Repeat, Option, RepeatFrom, Times } from './types.ts'
 */

import { assert } from "../asserts/module.f.mjs"
import { codePointListToString, stringToCodePointList } from "../text/utf16/module.f.mjs"
import { isFixedArray } from "../types/array/module.f.mjs"
import { toArray } from "../types/list/module.f.mjs"
import { empty, fromRange, isRangeSet, rangeSet, union } from "../types/range_set/module.f.mjs"

const isFixedArray2 =
    isFixedArray(2)

/**
 * The top ordinary symbol. The boundary above it, `2 ** 53`, is not a safe
 * integer, so it can never be written down: a range that reaches the top is an
 * open tail instead.
 */
const maxSymbol = Number.MAX_SAFE_INTEGER

/**
 * An ordinary symbol is a non-negative safe integer.
 *
 * Safe, because `b + 1` is exact only there — `2 ** 53 + 1` is `2 ** 53` — and
 * non-negative, because a set holds ordinary symbols only. `-1` is EOF, which
 * is a rule of its own rather than a member of any set, and a negative endpoint
 * is a mistake at the call site: the lowering's intersection with the domain
 * would clip it to a plausible but different set without a word.
 *
 * @type {(v: number) => boolean}
 */
const isSymbol = v => Number.isSafeInteger(v) && v >= 0

/**
 * The closed symbol range `a..b`, as a set value.
 *
 * `[a, b + 1]` for every range but one: when `b` is the top symbol there is no
 * boundary above it to write, so the range is the open tail `[a]`, which is the
 * only spelling it has.
 *
 * @throws If `a` or `b` is not an ordinary symbol, or if `b < a`.
 *
 * @type {(a: number, b: number) => RangeSet}
 */
export const rangeEncode = (a, b) => {
    assert(isSymbol(a) && isSymbol(b) && a <= b, [a, b])
    return b === maxSymbol ? rangeSet([a]) : fromRange([a, b + 1])
}

/**
 * The closed range spelled by a two-symbol string, as a set value.
 *
 * The bounds come off the code point list, so an astral symbol is one symbol
 * and not the two UTF-16 units that spell it.
 *
 * @throws If `ab` does not contain exactly two unicode code points.
 *
 * @type {(ab: string) => RangeSet}
 */
export const range = ab => {
    const a = toArray(stringToCodePointList(ab))
    assert(isFixedArray2(a))
    return rangeEncode(...a)
}

/**
 * The set of the symbols spelled by `a`, as a set value. Adjacent symbols
 * coalesce into one run and a repeat is the set of one, because `union` keeps
 * its result canonical.
 *
 * @type {(a: string) => RangeSet}
 */
export const set = a => toArray(stringToCodePointList(a))
    .map(b => rangeEncode(b, b))
    .reduce((x, y) => union(x)(y), empty)

/**
 * Whether `s` is a set a terminal can be made of: a range set of ordinary
 * symbols, and not the empty one.
 *
 * The empty set is a value like any other — it is the identity `union` folds
 * from — but as a terminal it is a rule that can never match, which is a
 * grammar error rather than a rule to build.
 *
 * @type {(s: RangeSet) => boolean}
 */
const isTerminalSet = s => isRangeSet(s) && s.length !== 0 && s.every(isSymbol)

/**
 * A rule matching one symbol of `s` — the single injection from a set value to
 * a rule, and so the one place a set is checked for being a terminal's.
 *
 * @throws If `s` is not a set of ordinary symbols, or is empty.
 *
 * @type {(s: RangeSet) => Set}
 */
export const oneOf = s => {
    assert(isTerminalSet(s), s)
    const r = /**@type {const}*/(['set', ...s])
    return () => r
}

/**
 * A repetition bound below: a count of matches. That is the same shape as a
 * symbol — a non-negative safe integer — under a name that says what it counts.
 *
 * @type {(v: number) => boolean}
 */
const isCount = isSymbol

/**
 * A repetition bound above: a count, or `Infinity` for an unbounded repeat.
 *
 * @type {(v: number) => boolean}
 */
const isMax = v => v === Infinity || isCount(v)

/**
 * `a` to `b` matches of `rule`, where `b` may be `Infinity`.
 *
 * The bounds are checked where they are bound rather than where the rule is
 * read: a negative, fractional or reversed cardinality is no repetition a
 * parser can carry out, and a rule spelling one would be a plausible wrong
 * value handed back in place of a refusal.
 *
 * @throws If `a` is not a count, if `b` is neither a count nor `Infinity`, or
 * if `b < a`.
 *
 * @type {<const A extends number, const B extends number>(a: A, b: B) =>
 *  <const R extends Rule>(rule: R) =>
 *  Repeat<A, B, R>}
 */
export const repeat = (a, b) => {
    assert(isCount(a) && isMax(b) && a <= b, [a, b])
    return rule => () => ['repeat', a, b, rule]
}

/**
 * `n` matches of a rule or more, with no bound above.
 *
 * @type {<const N extends number>(n: N) =>
 *  <const R extends Rule>(rule: R) =>
 *  RepeatFrom<N, R>}
 */
export const repeatFrom = n =>
    repeat(n, Infinity)

/**
 * Any number of matches, including none.
 *
 * @type {<const R extends Rule>(rule: R) => RepeatFrom<0, R>}
 */
export const repeatFrom0 = repeatFrom(0)

/**
 * @type {<const N extends number>(n: N) =>
 *  <const R extends Rule>(rule: R) => Times<N, R>}
 */
export const times = n => repeat(n, n)

/** @type {<const R extends Rule>(rule: R) => Option<R>} */
export const option = repeat(0, 1)

/**
 * A list of `r` separated by `s`, possibly empty — the shape a comma list is,
 * written out of the constructors above rather than as a rule form of its own.
 *
 * @type {<const S extends Rule>(s: S) =>
 *  <const R extends Rule>(r: R) =>
 *  Option<readonly[R, RepeatFrom<0, readonly[S, R]>]>}
 */
export const join = s => r => option([r, repeatFrom0([s, r])])

/**
 * The top Unicode code point, as the character it is rather than as its number,
 * so `range(` ${unicodeMax}`)` is a two-symbol string.
 */
export const unicodeMax =
    codePointListToString([0x10FFFF])
