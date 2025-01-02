import { todo } from "../dev/module.f.ts";
import { type CodePoint, stringToCodePointList } from '../text/utf16/module.f.ts'
import { map, toArray } from '../types/list/module.f.ts'
import { fromRange, merge, type RangeMapArray } from '../types/range_map/module.f.ts'

export type TerminalRange = readonly[CodePoint, CodePoint]

export type Sequence = readonly Rule[]
export type Or = { readonly or: Sequence }

export type DataRule = Sequence|Or|TerminalRange|string

//
export type LazyRule = () => DataRule
export type Rule = DataRule|LazyRule

const toTerminalRangeMap = map((cp: CodePoint): TerminalRange => [cp, cp])

const toTerminalRangeSequence = (s: string): readonly TerminalRange[] =>
    toArray(toTerminalRangeMap(stringToCodePointList(s)))

type Set = {
    readonly empty: boolean
    readonly map: RangeMapArray<boolean>
}

const rangeMap = fromRange(false)

const rangeToSet = (r: TerminalRange): Set => ({ empty: false, map: rangeMap(r)(true) })

const isTerminalRange = (rule: Sequence|TerminalRange): rule is TerminalRange => typeof rule[0] === 'number'

const set = (rule: Rule): Set => {
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
            return { empty: false, map: rangeMap(rule)(true) }
        }
        let result = { empty: true, map: [] }
        let i = 0
        do {
            todo()
            // result = merge()
            ++i
        } while (result.empty && rule.length !== i)
        return result
    }
    return todo()
}

