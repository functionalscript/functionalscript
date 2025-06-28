import { todo } from '../../dev/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import type { RangeMapArray } from '../../types/range_map/module.f.ts'
import {
    oneEncode,
    type DataRule,
    type Rule as FRule,
    type Sequence as FSequence,
} from '../module.f.ts'

// The same as functional TerminalRange
export type TerminalRange = number

// A sequence of rule names.
export type Sequence = readonly string[]

/** A variant of rule names. */
export type Variant = {
    readonly [k in string]: string
}

export type Rule = Variant | Sequence | TerminalRange

/** The full grammar */
export type RuleSet = Readonly<Record<string, Rule>>

//

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

const mapOneEncode = map(oneEncode)

const data = (dr: DataRule): NewRule => {
    switch (typeof dr) {
        case 'string': {
            return sequence(toArray(mapOneEncode(stringToCodePointList(dr))))
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

type DispatchRule = readonly [boolean, Dispatch]

type Dispatch = RangeMapArray<DispatchRule>

type DispatchMap = { readonly[id in string]: Dispatch }

/**
 * Represents a parsed Abstract Syntax Tree (AST) sequence.
 */
export type AstSequence = readonly(AstRule|CodePoint)[]

/**
 * Represents a parsed AST rule, consisting of a rule name and its parsed sequence.
 */
export type AstRule = readonly[string, AstSequence]

/**
 * Represents the remaining input after a match attempt, or `null` if no match is possible.
 */
export type Remainder = readonly CodePoint[] | null

/**
 * Represents the result of a match operation, including the parsed AST rule and the remainder of the input.
 */
export type MatchResult = readonly[AstRule, Remainder]

/**
 * Represents an LL(1) parser function for matching input against grammar rules.
 */
export type Match = (name: string, s: readonly CodePoint[]) => MatchResult

export const parser = (fr: FRule): Match => {
    const data = toData(fr)
    
    return todo()
}

/**
 * Either `{ variantItem: id }` or `id`.
 */
/*
type DispatchRule = SingleProperty<> | string

type Dispatch = RangeMapArray<DispatchRule>

type DispatchMap = { readonly[id in string]: Dispatch }
*/
