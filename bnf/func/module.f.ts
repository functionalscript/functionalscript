/**
 *  Types for defining language grammar using Backus-Naur Form (BNF).
 *
 * @module
 *
 * @description
 *
 * Utilities for serializing and deserializing BNF grammar
 * and creating a simple LL(1) parser.
 *
 * See [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form).
 *
 * @example
 *
 * ```ts
 * import type { Rule } from './module.f.ts'
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
export type Or = readonly Sequence[]

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
 * ]
 * const id: Sequence = [alpha, alpha0x]
 * ```
 */
export type Rule = () => Or

const toTerminalRangeMap = map(one)

/**
 * Converts a string to an array of terminal ranges where each character is a separate range.
 *
 * @param s - The input string.
 * @returns An array of terminal ranges representing each character in the string.
 *
 * @example
 *
 * ```ts
 * const ranges = str('abc') // [[97, 97], [98, 98], [99, 99]]
 * ```
 */
export const str = (s: string): readonly TerminalRange[] =>
    toArray(toTerminalRangeMap(stringToCodePointList(s)))

/**
 * Converts a single character string to a terminal range.
 *
 * @param a - The input character string.
 * @returns A terminal range representing the character.
 *
 * @example
 * ```ts
 * const range = cp('A'); // [65, 65]
 * ```
 */
export const cp = (a: string): TerminalRange => one(a.codePointAt(0) as number)

/**
 * Converts a two-character string into a terminal range.
 *
 * @param ab - The input string of two characters.
 * @returns A terminal range representing the two characters.
 *
 * @throws {number} Throws an error if the input string does not have exactly two code points.
 *
 * @example
 * ```ts
 * const result = range('AZ'); // [65, 90]
 * ```
 */
export const range = (ab: string): TerminalRange => {
    const a = toArray(stringToCodePointList(ab))
    if (a.length !== 2) {
        throw a.length
    }
    // deno-lint-ignore no-explicit-any
    return a as any as TerminalRange
}

type RangeSet = readonly TerminalRange[]

/**
 * A set of terminal ranges compatible with the `Or` rule.
 */
export type OrRangeSet = readonly (readonly [TerminalRange])[]

const removeOne = (set: RangeSet, [a, b]: TerminalRange): RangeSet => {
    let result: RangeSet = []
    for (const [a0, b0] of set) {
        if (a0 < a) {
            // [a0
            //     ]a
            result = [...result, [a0, Math.min(b0, a - 1)]]
        }
        if (b < b0) {
            //    b0]
            // b[
            result = [...result, [Math.max(b + 1, a0), b0]]
        }
    }
    return result
}

/**
 * Removes a terminal range from a set of ranges.
 *
 * @param range the original range.
 * @param removeSet the set of ranges to be removed.
 * @returns The resulting set of ranges after removal.
 *
 * @example
 *
 * ```ts
 * const result = remove([65, 90], [cp('C'), cp('W')]) // [A..Z] w/o C and W
 * ```
 */
export const remove = (range: TerminalRange, removeSet: RangeSet): OrRangeSet => {
    let result: RangeSet = [range]
    for (const r of removeSet) {
        result = removeOne(result, r)
    }
    return result.map(v => [v])
}
