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
 * const s = firstSet(grammar)
 * if (s.empty) { throw s }
 * if (setOp.get('0'.codePointAt(0) as number)(s.map) !== true) { throw s }
 * if (setOp.get('h'.codePointAt(0) as number)(s.map) !== true) { throw s }
 * if (setOp.get('$'.codePointAt(0) as number)(s.map) !== false) { throw s }
 * ```
 */

import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { one } from '../../types/range/module.f.ts'
import { rangeMap, type RangeMapOp, type RangeMapArray } from '../../types/range_map/module.f.ts'

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

export const toTerminalRangeSequence = (s: string): readonly TerminalRange[] =>
    toArray(toTerminalRangeMap(stringToCodePointList(s)))

/**
 * A set that represents possible code points.
 */
export type CpSet = {
    /**
     * Whether a grammar rule allows an empty sequence.
     */
    readonly empty: boolean
    /**
     * The range map representing a set of possible code points.
     */
    readonly map: RangeMapArray<boolean>
}

/**
 * Operations on code point sets.
 */
export const setOp: RangeMapOp<boolean> = rangeMap({
    union: a => b => a || b,
    equal: a => b => a === b,
    def: false
})

const { merge, fromRange } = setOp

const rangeToSet = (r: TerminalRange): CpSet =>
    ({ empty: false, map: fromRange(r)(true) })

const passSet: CpSet = { empty: true, map: [] }

const firstSetSequence = (s: Sequence|string): CpSet => {
    if (typeof s === 'string') {
        const first = s.codePointAt(0)
        if (first === undefined) {
            return passSet
        }
        return rangeToSet(one(first))
    }
    let result: RangeMapArray<boolean> = []
    for (const r of s) {
        const { empty, map } =
            r instanceof Array ? rangeToSet(r) : firstSet(r)
        result = toArray(merge(result)(map))
        if (!empty) {
            return { empty: false, map: result }
        }
    }
    return { empty: true, map: result }
}

/**
 * Processes a `Rule` and converts it into a `Set` of possible code points at the start of the rule.
 *
 * @param rule - The grammar rule to process.
 * @returns A set representing the first possible code points in the grammar rule.
 */
export const firstSet = (rule: Rule): CpSet => {
    const or = rule()
    let empty = false
    let map: RangeMapArray<boolean> = []
    for (const r of or) {
        const { empty: rEmpty, map: rMap } = firstSetSequence(r)
        map = toArray(merge(map)(rMap))
        empty ||= rEmpty
    }
    return { empty, map }
}
