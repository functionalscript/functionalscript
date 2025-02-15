import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import type {
    DataRule,
    Rule as FRule,
    Sequence as FSequence,
} from '../module.f.ts'
export type TerminalRange = number

export type Sequence = readonly string[]

export type Variant = {
    readonly [k in string]: string
}

export type Rule = Variant | Sequence | TerminalRange

export type RuleSet = Readonly<Record<string, Rule>>

type FRuleMap = { readonly [k in string]: FRule }

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

type NewRule = (m: FRuleMap) => readonly [FRuleMap, RuleSet, Rule]

const sequence = (list: FSequence): NewRule => map => {
    let result: Sequence = []
    let set = {}
    for (const fr of list) {
        const [map1, set1, id] = toDataAdd(map)(fr)
        map = map1
        set = { ...set, ...set1 }
        result = [...result, id]
    }
    return [map, set, result]
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
            return sequence(toArray(stringToCodePointList(dr)))
        }
        case 'number':
            return m => [m, {}, dr]
        default:
            if (dr instanceof Array) {
                return sequence(dr)
            }
            return variant(dr)
    }
}

const toDataAdd = (map: FRuleMap) => (fr: FRule): readonly [FRuleMap, RuleSet, string] => {
    {
        const id = find(map)(fr)
        if (id !== undefined) {
            return [map, {}, id]
        }
    }
    const [dr, tmpId]: readonly [DataRule, string] =
        typeof fr === 'function' ? [fr(), fr.name] : [fr, '']
    const newRule = data(dr)
    const id = newName(map, tmpId)
    const map1 = { ...map, [id]: fr }
    const [map2, set, rule] = newRule(map1)
    return [map2, { ...set, [id]: rule }, id]
}

export const toData = (fr: FRule): readonly [RuleSet, string] => {
    const [, ruleSet, id] = toDataAdd({})(fr)
    return [ruleSet, id]
}
