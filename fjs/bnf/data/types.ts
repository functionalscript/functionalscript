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
 * Grammar rule definition.
 *
 * It can be one of:
 * - a tagged variant map,
 * - a sequence of referenced rule names,
 * - an encoded terminal range.
 */
export type Rule = Variant | Sequence | TerminalRange

/** The full grammar */
export type RuleSet = Readonly<Record<string, Rule>>

/**
 * Whether a rule can match empty input: `undefined` if it never can, `true`
 * if it can with no tag (a nullable sequence), or the tag of the nullable
 * variant branch.
 */
export type EmptyTag = string | true | undefined
