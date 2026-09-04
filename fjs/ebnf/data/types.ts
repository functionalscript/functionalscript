/**
 * Types for the serializable EBNF grammar: the intermediate representation
 * (IR) every backend consumes.
 *
 * A rule set is a map from name to rule, and every rule is a tagged tuple
 * whose first element names its kind. A string anywhere else in a rule is the
 * name of another rule of the same set. See `./README.md` for why this is the
 * carrier and what each kind means.
 *
 * @module
 */

import type { AbstractRequiredMap, StringMap } from '../../types/object/types.ts'
import type { RangeSet } from '../../types/range_set/types.ts'
import type { Rule as FRule } from '../types.ts'

/**
 * One symbol from a set of ordinary symbols, or EOF.
 *
 * The boundaries are a canonical {@link RangeSet} of safe integers, non-empty,
 * and either exactly `[-1, 0]` — EOF, the one set with a negative boundary,
 * which contributes no leaf — or entirely at or above `0`. A set never mixes
 * the two.
 */
export type Terminal = readonly ['set', ...RangeSet]

/** The named rules, in order. */
export type Sequence = readonly ['sequence', ...readonly string[]]

/** One of the named rules, by tag. */
export type Variant = readonly ['variant', StringMap<string>]

/**
 * `min..max` copies of the named rule: `min` a non-negative safe integer,
 * `max` one or `Infinity`, `min <= max`.
 */
export type Repeat = readonly ['repeat', number, number, string]

export type Rule = Terminal | Sequence | Variant | Repeat

/** The full grammar: every rule the entry reaches, by name. */
export type RuleSet = AbstractRequiredMap<string, Rule>

/**
 * Front-end rules keyed to the names the lowering gave them — the bridge a
 * transformer keyed by the rule an author wrote crosses to reach its data
 * rule.
 */
export type RuleNameMap = ReadonlyMap<FRule, string>

/** What `toData` returns: the rule set, its entry, and the identity map. */
export type GrammarData = readonly [
    ruleSet: RuleSet,
    entry: string,
    names: RuleNameMap,
]

/**
 * One handler per rule kind, each receiving the rule's payload without its
 * tag. `matchRule` in `./module.f.mjs` is the one place the tag is read.
 */
export type RuleVisitor<R> = {
    readonly set: (s: RangeSet) => R
    readonly sequence: (items: readonly string[]) => R
    readonly variant: (branches: StringMap<string>) => R
    readonly repeat: (min: number, max: number, item: string) => R
}

/**
 * Whether a rule can match empty input: `undefined` if it never can, `true`
 * if it can with no tag (a nullable sequence, or a repeat), or the tag of the
 * nullable variant branch.
 */
export type EmptyTag = string | true | undefined

/** The {@link EmptyTag} of every rule in a {@link RuleSet}, keyed by name. */
export type EmptyTagMap = StringMap<EmptyTag>
