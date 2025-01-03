/**
 * @module
 *
 * Types for defining language grammars using Backus-Naur Form (BNF).
 *
 * The primary utility of this module is to define grammars for text processing,
 * parsing, and lexing in a structured and reusable way.
 *
 * @example
 *
 * ```js
 * import { firstSet, type Rule, type Set } from './module.f.ts'
 *
 * const grammar: Rule = [
 *     { or: [[65, 90], [97, 122], [48, 57]] }, // Matches 'A-Z', 'a-z', and '0-9'
 * ];
 *
 * const s = firstSet(grammar)
 * if (s.empty) { throw s }
 * if (setOp.get('0'.codePointAt(0))(s.map) !== true) { throw s }
 * if (setOp.get('h'.codePointAt(0))(s.map) !== true) { throw s }
 * if (setOp.get('$'.codePointAt(0))(s.map) !== false) { throw s }
 * ```
 */

import { type CodePoint, stringToCodePointList } from '../text/utf16/module.f.ts'
import { map, toArray } from '../types/list/module.f.ts'
import { rangeMap, type RangeMapOp, type RangeMapArray } from '../types/range_map/module.f.ts'

/**
 * Represents a terminal range as a pair of Unicode code points.
 * Typically used to define character ranges.
 */
export type TerminalRange = readonly [CodePoint, CodePoint]

/**
 * Represents a sequence of rules.
 * Sequences are ordered lists of rules that must match in order.
 */
export type Sequence = readonly Rule[]

/**
 * Represents a logical "or" operation between multiple sequences.
 * Allows defining alternatives within the grammar.
 */
export type Or = { readonly or: Sequence }

/**
 * Represents a grammar rule, which can be:
 * - A sequence of rules (`Sequence`)
 * - An "or" operation (`Or`)
 * - A terminal range (`TerminalRange`)
 * - A string (representing a literal sequence of characters)
 */
export type DataRule = Sequence | Or | TerminalRange | string

/**
 * Represents a lazy grammar rule.
 * A function that resolves to a `DataRule`
 */
export type LazyRule = () => DataRule

/**
 * Represents a rule in the grammar.
 */
export type Rule = DataRule | LazyRule

const toTerminalRangeMap = map((cp: CodePoint): TerminalRange => [cp, cp])

const toTerminalRangeSequence = (s: string): readonly TerminalRange[] =>
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

const rangeToSet = (r: TerminalRange): CpSet => ({ empty: false, map: fromRange(r)(true) })

const isTerminalRange = (rule: Sequence | TerminalRange): rule is TerminalRange =>
    typeof rule[0] === 'number'

/**
 * Processes a `Rule` and converts it into a `Set` of possible code points at the start of the rule.
 *
 * @param rule - The grammar rule to process.
 * @returns A set representing the first possible code points in the grammar rule.
 */
export const firstSet = (rule: Rule): CpSet => {
    if (typeof rule === 'function') {
        rule = rule()
    }
    if (typeof rule === 'string') {
        const a = toTerminalRangeSequence(rule)
        if (a.length === 0) {
            return { empty: true, map: [] }
        }
        return rangeToSet(a[0])
    }
    if (rule instanceof Array) {
        if (isTerminalRange(rule)) {
            return { empty: false, map: fromRange(rule)(true) }
        }
        let result: RangeMapArray<boolean> = []
        for (const r of rule) {
            const { empty, map } = firstSet(r)
            result = toArray(merge(result)(map))
            if (!empty) {
                return { empty: false, map: result }
            }
        }
        return { empty: true, map: result }
    }
    let empty = false
    let map: RangeMapArray<boolean> = []
    for (const r of rule.or) {
        const { empty: rEmpty, map: rMap } = firstSet(r)
        map = toArray(merge(map)(rMap))
        empty ||= rEmpty
    }
    return { empty, map }
}
