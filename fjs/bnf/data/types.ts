/**
 * Types for the serializable BNF intermediate representation (IR).
 *
 * @module
 */

import type { StringMap } from '../../types/object/types.ts'

/**
 * Encoded terminal range value used by BNF data rules.
 *
 * The same as the functional TerminalRange.
 */
export type TerminalRange = number

/**
 * Ordered list of grammar rule names.
 */
export type Sequence = readonly string[]

/** A variant of rule names. */
export type Variant = StringMap<string>

/**
 * Zero or more repetitions of one rule.
 *
 * The functional grammar has no repetition primitive — `repeat0Plus(x)` expands
 * to a right-recursive variant — so this is the one rule kind `toData` derives
 * rather than transcribes: it recognizes the unambiguous 0-or-more shape and
 * emits this instead, which is what lets a parser backend match the body
 * iteratively and produce one flat node for the whole repetition.
 *
 * The body is a one-element array rather than a bare rule name so the shape
 * stays unambiguous against {@link Variant}: a variant maps every branch to a
 * rule *name*, so an object holding an array can never be one — including a
 * variant with a branch literally called `repeat`. It is an array rather than
 * a bare object field so the body has room to become a whole {@link Sequence}
 * later without changing the encoding.
 */
export type Repeat = { readonly repeat: readonly[string] }

/**
 * Grammar rule definition.
 *
 * It can be one of:
 * - a tagged variant map,
 * - a sequence of referenced rule names,
 * - an encoded terminal range,
 * - a zero-or-more repetition of one rule.
 */
export type Rule = Variant | Sequence | TerminalRange | Repeat

/** The full grammar */
export type RuleSet = Readonly<Record<string, Rule>>

/**
 * Whether a rule can match empty input: `undefined` if it never can, `true`
 * if it can with no tag (a nullable sequence), or the tag of the nullable
 * variant branch.
 */
export type EmptyTag = string | true | undefined
