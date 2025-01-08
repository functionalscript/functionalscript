/**
 *  Types for defining language grammars using Backus-Naur Form (BNF).
 *
 * @module
 *
 * @description
 *
 * The primary utility of this module is to define grammars for text processing,
 * parsing, and lexing in a structured and reusable way.
 *
 * See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).
 *
 * @example
 *
 * ```ts
 * import { firstSet, type Rule, type Set, setOp } from './module.f.ts'
 *
 * // Matches 'A-Z', 'a-z', and '0-9'
 * const grammar: Rule = () => [
 *     [[65, 90]],
 *     [[97, 122]],
 *     [[48, 57]],
 * ]
 * ```
 */

import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { one } from '../../types/range/module.f.ts'

/**
 * Represents a terminal range as a pair of Unicode code points.
 * Typically used to define character ranges.
 *
 * @example
 *
 * ```ts
 * const alpha: TerminalRange = [65, 90] // Matches 'A-Z'
 * ```
 */
export type TerminalRange = readonly [CodePoint, CodePoint]

/**
 * Represents a sequence of rules that must match in order.
 *
 * @example
 *
 * ```ts
 * const alpha: TerminalRange = [65, 90] // Matches 'A-Z'
 * const id2: Sequence = [alpha, alpha]  // Matches two uppercase letters
 * ```
 */
export type Sequence = readonly (TerminalRange|Rule)[]

/**
 * Represents a logical "or" operation between multiple sequences.
 * Allows defining alternatives within the grammar.
 *
 * @example
 *
 * ```ts
 * const alpha: TerminalRange = [65, 90] // Matches 'A-Z'
 * const id2: Sequence = [alpha, alpha]  // Matches two uppercase letters
 * const digit: TerminalRange = [48, 57] // Matches '0-9'
 * // Matches two uppercase letters or one digit
 * const id2OrDigit: Or = [
 *     id2,
 *     [digit],
 * ]
 * ```
 */
export type Or = readonly (Sequence|string)[]

/**
 * Represents a lazy grammar rule for recursive definitions.
 *
 * @example
 *
 * ```ts
 * const alpha: TerminalRange = [65, 90]  // Matches 'A-Z'
 * // zero or more alpha symbols
 * const alpha0x: Rule = () => [
 *     [],              // Empty
 *     [alpha, alpha0x] // Recursive
 * ] }]
 * const id: Sequence = [alpha, alpha0x]
 * ```
 */
export type Rule = () => Or

const toTerminalRangeMap = map((cp: CodePoint): TerminalRange => [cp, cp])

export const seq = (s: string): readonly TerminalRange[] =>
    toArray(toTerminalRangeMap(stringToCodePointList(s)))

export const cp = (a: string) => one(a.codePointAt(0) as number)
