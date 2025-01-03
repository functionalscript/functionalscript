import { type CodePoint, stringToCodePointList } from '../text/utf16/module.f.ts'
import { map, toArray } from '../types/list/module.f.ts'
import { rangeMap, type RangeMapArray } from '../types/range_map/module.f.ts'

export type TerminalRange = readonly [CodePoint, CodePoint]

export type Sequence = readonly Rule[]
export type Or = { readonly or: Sequence }

export type DataRule = Sequence | Or | TerminalRange | string

//
export type LazyRule = () => DataRule
export type Rule = DataRule | LazyRule

const toTerminalRangeMap = map((cp: CodePoint): TerminalRange => [cp, cp])

const toTerminalRangeSequence = (s: string): readonly TerminalRange[] =>
    toArray(toTerminalRangeMap(stringToCodePointList(s)))

export type Set = {
    readonly empty: boolean
    readonly map: RangeMapArray<boolean>
}

const { merge, fromRange } = rangeMap({
    union: a => b => a || b,
    equal: a => b => a === b,
    def: false
})

const rangeToSet = (r: TerminalRange): Set => ({ empty: false, map: fromRange(r)(true) })

const isTerminalRange = (rule: Sequence | TerminalRange): rule is TerminalRange =>
    typeof rule[0] === 'number'

export const set = (rule: Rule): Set => {
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
            const { empty, map } = set(r)
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
        const { empty: rEmpty, map: rMap } = set(r)
        map = toArray(merge(map)(rMap))
        empty ||= rEmpty
    }
    return { empty, map }
}
