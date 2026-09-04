/**
 * Types for the serializable BNF intermediate representation (IR).
 *
 * @module
 */

import type { AbstractRequiredMap, StringMap } from '../../types/object/types.ts'
import type { Rule as FRule } from '../types.ts'

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
 * Zero or more repetitions of the named rule.
 *
 * The functional grammar has no repetition primitive — `repeat0Plus(x)` expands
 * to a right-recursive variant — so this is the one rule kind `toData` derives
 * rather than transcribes: it recognizes the unambiguous 0-or-more shape and
 * emits this instead, which is what lets a parser backend match the body
 * iteratively and produce one flat node for the whole repetition.
 *
 * A bare rule name keeps the four rule kinds disjoint by JavaScript type alone:
 * a number is a {@link TerminalRange}, an array a {@link Sequence}, an object a
 * {@link Variant}, and a string this. Nothing else in a {@link RuleSet} is a
 * string, so no shape has to be probed to tell one kind from another. (The
 * *functional* `DataRule` does have a string case — a Unicode literal — but
 * that one never reaches here: `toData` expands it to terminals.)
 */
export type Repeat = string

/**
 * Grammar rule definition.
 *
 * It can be one of:
 * - a tagged variant map,
 * - a sequence of referenced rule names,
 * - an encoded terminal range,
 * - the name of a rule to repeat zero or more times.
 */
export type Rule = Variant | Sequence | TerminalRange | Repeat

/** The full grammar */
export type RuleSet = AbstractRequiredMap<string, Rule>

/** Functional rules keyed to the generated names used by a {@link RuleSet}. */
export type RuleNameMap = ReadonlyMap<FRule, string>

/** Grammar data together with the functional-rule identities that produced it. */
export type GrammarData = readonly[
    ruleSet: RuleSet,
    entry: string,
    names: RuleNameMap,
]

/**
 * Whether a rule can match empty input: `undefined` if it never can, `true`
 * if it can with no tag (a nullable sequence), or the tag of the nullable
 * variant branch.
 */
export type EmptyTag = string | true | undefined

/**
 * The {@link EmptyTag} of every rule in a {@link RuleSet}, keyed by rule name.
 */
export type _EmptyTagMap = StringMap<EmptyTag>
