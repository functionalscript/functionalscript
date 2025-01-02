import { todo } from "../dev/module.f.ts";
import { type CodePoint, stringToCodePointList } from '../text/utf16/module.f.ts'
import { length, map, toArray } from '../types/list/module.f.ts'
import { fromRange, merge, Operators, type RangeMapArray } from '../types/range_map/module.f.ts'

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

const op: Operators<boolean> = {
    union: a => b => a || b,
    equal: a => b => a === b
}

const setMerge = merge(op)

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
        let result: RangeMapArray<boolean> = []
        for (const r of rule) {
            const { empty, map } = set(r)
            result = toArray(setMerge(result)(map))
            if (!empty) {
                return { empty: false, map: result }
            }
        }
        return { empty: true, map: result }
    }
    return todo()
}

