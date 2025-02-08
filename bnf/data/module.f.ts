import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { type DataRule, oneEncode, rangeToId, type Rule as FRule, isEmpty } from '../module.f.ts'

export type TerminalRange = number

export type Sequence = readonly string[]

export type Variant = {
    readonly[k in string]: string
}

export type Rule = Variant | Sequence | TerminalRange

export type RuleSet = Readonly<Record<string, Rule>>

type FRuleMap = { readonly[k in string]: FRule }

const { entries } = Object

const find = (map: FRuleMap) => (fr: FRule): string | undefined => {
    for (const [k, v] of entries(map)) {
        if (v === fr) {
            return k
        }
    }
    return undefined
}

const newName = (map: FRuleMap, name: string) => {
    let i = 0
    let result = name
    while (result in map) {
        result = name + i
        ++i
    }
    return result
}

const { fromCodePoint } = String

const empty: NewRule = m => [m, {}, []]

type NewRule = (m: FRuleMap) => readonly[FRuleMap, RuleSet, Rule]

const sequence = (first: FRule, tail: FRule): NewRule => map => {
    const [map1, firstRules, firstId] = toDataAdd(map)(first)
    if (isEmpty(tail)) {
        return [map1, firstRules, [firstId]]
    }
    const [map2, tailRules, tailId] = toDataAdd(map1)(tail)
    return [map2, { ...firstRules, ...tailRules }, [firstId, tailId]]
}

const variant = (fr: FRule): NewRule => map => {
    let set: RuleSet = {}
    let rule: Variant = {}
    for (const [k, v] of entries(fr)) {
        const [m1, s, id] = toDataAdd(map)(v)
        map = m1
        set = { ...set, ...s }
        rule = { ...rule, [k]: id }
    }
    return [map, set, rule]
}

const data = (dr: DataRule): NewRule => {
    switch (typeof dr) {
        case 'string': {
            if (dr.length === 0) {
                return empty
            }
            const [firstCp, ...tailCp] = toArray(stringToCodePointList(dr))
            return sequence(oneEncode(firstCp), fromCodePoint(...tailCp))
        }
        case 'number':
            return m => [m, {}, dr]
        default:
            if (dr instanceof Array) {
                if (dr.length === 0) {
                    return empty
                }
                const [first, ...tail] = dr
                return sequence(first, tail)
            }
            return variant(dr)
    }
}

const toDataAdd = (map: FRuleMap) => (fr: FRule): readonly[FRuleMap, RuleSet, string] =>  {
    {
        const id = find(map)(fr)
        if (id !== undefined) {
            return [map, {}, id]
        }
    }
    const [dr, tmpId]: readonly[DataRule, string] = typeof fr === 'function' ? [fr(), fr.name] : [fr, '']
    const newRule = data(dr)
    const id = newName(map, tmpId)
    const map1 = { ...map, [id]: fr }
    const [map2, set, rule] = newRule(map1)
    return [map2, { ...set, [id]: rule }, id]
}

export const toData = (fr: FRule): readonly[RuleSet, string] => {
    const [, ruleSet, id] = toDataAdd({})(fr)
    return [ruleSet, id]
}
