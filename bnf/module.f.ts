import { type CodePoint, stringToCodePointList } from '../text/utf16/module.f.ts'
import { map, toArray } from '../types/list/module.f.ts'
import { fromRange, merge, type RangeMapArray } from '../types/range_map/module.f.ts'

export type TerminalRange = readonly[CodePoint, CodePoint]
export type Terminal2 = { readonly _: TerminalRange }

export type Sequence = readonly Rule[]
export type Or = { readonly or: Sequence }

export type DataRule = Sequence|Or|Terminal2|string

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

const codePointToSet = (cp: CodePoint): Set => ({ empty: false, map: rangeMap([cp, cp])(true) })

/*
const set = (rule: Rule): Set => {
    if (typeof rule === 'function') {
        rule = rule()
    }
    if (typeof rule === 'string') {
        if (rule.length === 0) {
            return { empty: true, map: [] }
        }
        const range = toTerminalRangeSequence(rule)[0][0]
        return codePointToSet(range)
    }
    if (rule instanceof Array) {
        let result = { empty: true, map: [] }
        let i = 0
        do {
            // result = merge()
            ++i
        } while (result.empty && rule.length !== i)
        return result
    }
}
*/
