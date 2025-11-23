import { todo } from '../../dev/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { strictEqual } from '../../types/function/operator/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { rangeMap, type RangeMapArray } from '../../types/range_map/module.f.ts'
import { contains, set, type StringSet } from '../../types/string_set/module.f.ts'
import { contains as rangeContains } from '../../types/range/module.f.ts'
import {
    oneEncode,
    rangeDecode,
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

type EmptyTag = string|true|undefined

type EmptyTagEntry = string|boolean

type DispatchRule = {
    readonly emptyTag: EmptyTag,
    readonly rangeMap: Dispatch
}

type Dispatch = RangeMapArray<DispatchResult>

type DispatchResult = DispatchRuleCollection | null

type DispatchRuleOrName = DispatchRule | string

type DispatchRuleCollection = {
    readonly tag: string | undefined,
    readonly rules: DispatchRuleOrName[]
}

type DispatchMap = { readonly[id in string]: DispatchRule }

type EmptyTagMap = { readonly[id in string]: EmptyTagEntry }

export type DescentMatchRule = (name: string, tag: AstTag, s: readonly CodePoint[], idx: number) => DescentMatchResult

export type DescentMatchResult = readonly[AstRule, boolean, number]

export type DescentMatch = (name: string, s: readonly CodePoint[]) => DescentMatchResult

/**
 * Represents a parsed Abstract Syntax Tree (AST) sequence.
 */
export type AstSequence = readonly(AstRule|CodePoint)[]

type AstTag = string|true|undefined

/**
 * Represents a parsed AST rule, consisting of a rule name and its parsed sequence.
 */
type AstRule = {
    readonly tag: AstTag,
    readonly sequence: AstSequence
}

/**
 * Represents the remaining input after a match attempt, or `null` if no match is possible.
 */
export type Remainder = readonly CodePoint[] | null

/**
 * Represents the result of a match operation, including the parsed AST rule and the remainder of the input.
 */
export type MatchResult = readonly[AstRule, boolean, Remainder]

/**
 * Represents an LL(1) parser function for matching input against grammar rules.
 */
export type Match = (name: string, s: readonly CodePoint[]) => MatchResult

export type MatchRule = (dr: DispatchRule, s: readonly CodePoint[]) => MatchResult

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

const dispatchOp = rangeMap<DispatchResult>({
    union: a => b => {
        if (a === null) {
            return b
        }
        if (b === null) {
            return a
        }
        throw ['can not merge [', a, '][', b, ']']
    },
    equal: strictEqual,
    def: null,
})

export const dispatchMap = (ruleSet: RuleSet): DispatchMap => {

    const addRuleToDispatch = (dr: DispatchResult, name: string): DispatchResult => {
        if (dr === null)
            return null

        return { tag: dr.tag, rules: [...dr.rules, name]}
    }

    const addTagToDispatch = (dr: DispatchResult, tag: string): DispatchResult => {
        if (dr === null)
            return null

        return { tag, rules: dr.rules}
    }

    const dispatchRule = (dm: DispatchMap, name: string, current: StringSet): DispatchMap => {
        if (name in dm) { return dm }
        const newCurrent = set(name)(current)
        const rule = ruleSet[name]
        if (typeof rule === 'number') {
            const range = rangeDecode(rule)
            const dispatch = dispatchOp.fromRange(range)({tag: undefined, rules: []})
            const dr: DispatchRule = {emptyTag: undefined, rangeMap: dispatch}
            return { ...dm, [name]: dr }
        } else if (rule instanceof Array) {
            let emptyTag: EmptyTag = true
            let result: Dispatch = []
            for (const item of rule) {
                if (contains(item)(newCurrent)) {
                    result = result.map(x => [addRuleToDispatch(x[0], item), x[1]])
                } else {
                    dm = dispatchRule(dm, item, newCurrent)
                    const dr = dm[item]
                    if (emptyTag === true) {
                        result = result.map(x => [addRuleToDispatch(x[0], item), x[1]])
                        result = toArray(dispatchOp.merge(result)(dr.rangeMap))
                        emptyTag = dr.emptyTag !== undefined ? true : undefined
                    } else {
                        result = result.map(x => [addRuleToDispatch(x[0], item), x[1]])
                    }
                }
            }
            const dr: DispatchRule = {emptyTag, rangeMap: result}
            return { ...dm, [name]: dr}
        } else {
            const entries = Object.entries(rule)
            let result: Dispatch = []
            let emptyTag: EmptyTag = undefined
            for (const [tag, item] of entries) {
                dm = dispatchRule(dm, item, newCurrent)
                const dr = dm[item]
                if (dr.emptyTag !== undefined) {
                    emptyTag = tag
                } else {
                    const d: Dispatch = dr.rangeMap.map(x => [addTagToDispatch(x[0], tag), x[1]])
                    result = toArray(dispatchOp.merge(result)(d))
                }
            }
            const dr: DispatchRule = {emptyTag, rangeMap: result}
            return { ...dm, [name]: dr}
        }
    }

    let result: DispatchMap = {}
    for (const k in ruleSet) {
        result = dispatchRule(result, k, null)
    }

    return result
}

const emptyTagMapAdd = (ruleSet: RuleSet) => (map: EmptyTagMap) => (name: string): readonly [RuleSet, EmptyTagMap, EmptyTagEntry] => {
    if (name in map) {
        return [ruleSet, map, map[name]]
    }

    const rule = ruleSet[name]

    if (typeof rule === 'number') {
        return [ruleSet, { ...map, [name]: false }, false]
    } else if (rule instanceof Array) {
        map = { ...map, [name]: true}
        let emptyTag: EmptyTagEntry = rule.length == 0
        for (const item of rule) {
            const [,newMap,itemEmptyTag] = emptyTagMapAdd(ruleSet)(map)(item)
            map = newMap         
            if (emptyTag === false) {
                emptyTag = itemEmptyTag !== false
            }
        }
        return [ruleSet, { ...map, [name]: emptyTag }, emptyTag]
    } else {
        map = { ...map, [name]: true}
        const entries = Object.entries(rule)
        let emptyTag: EmptyTagEntry = false
        for (const [tag, item] of entries) {
            const [,newMap,itemEmptyTag] = emptyTagMapAdd(ruleSet)(map)(item)
            map = newMap
            if (itemEmptyTag !== false) {
                emptyTag = tag
            }
        }
        return [ruleSet, { ...map, [name]: emptyTag }, emptyTag]
    }
}

export const createEmptyTagMap = (data: readonly [RuleSet, string]): EmptyTagMap => {
    return emptyTagMapAdd(data[0])({})(data[1])[1]
}

export const descentParser = (fr: FRule): DescentMatch => {
    const data = toData(fr)
    const emptyTagMap = createEmptyTagMap(data)

    const getEmptyTag = (name: string): EmptyTag => {
        const res = emptyTagMap[name]
        return res === false ? undefined : res
    }

    const f: DescentMatchRule = (name, tag, cp, idx): DescentMatchResult => {
        const mrSuccess = (tag: AstTag, sequence: AstSequence, idx: number): DescentMatchResult => [{tag, sequence}, true, idx]
        const mrFail = (tag: AstTag, sequence: AstSequence, idx: number): DescentMatchResult => [{tag, sequence}, false, idx]

        const emptyTag = getEmptyTag(name)

        if (idx >= cp.length) {
            return emptyTag === undefined ? mrFail(emptyTag, [], idx) : mrSuccess(emptyTag, [], idx)
        }

        const rule = data[0][name]
        if (typeof rule === 'number') {            
            const cpi = cp[idx]
            const range = rangeDecode(rule)            
            if (rangeContains(range)(cpi)) {
                return mrSuccess(tag, [cpi], idx + 1)
            }
            return mrFail(emptyTag, [], idx)
        } else if (rule instanceof Array) {            
            let seq: AstSequence = []
            let tidx = idx
            for (const item of rule) {
                const m = f(item, undefined, cp, tidx)
                const [astRule, success, nidx] = m
                tidx = nidx
                if (success === false) {
                    return mrFail(tag, [], idx)
                }
                seq = [...seq, astRule]
            }
            return mrSuccess(tag, seq, tidx)
        } else {
            const entries = Object.entries(rule)
            for (const [tag, item] of entries) {
                const m = f(item, tag, cp, idx)
                if (m[1]) {
                    return m
                }
            }
            return mrFail(emptyTag, [], idx)
        }        
    }

    const match: DescentMatch = (name, cp): DescentMatchResult => {
        return f(name, undefined, cp, 0)
    }
    
    return match
}

export const parser = (fr: FRule): Match => {
    const data = toData(fr)
    return parserRuleSet(data[0])
}

export const parserRuleSet = (ruleSet: RuleSet): Match => {
    const map = dispatchMap(ruleSet)

    const f: MatchRule = (rule, cp): MatchResult => {
        const mrSuccess = (tag: AstTag, sequence: AstSequence, r: Remainder): MatchResult => [{tag, sequence}, true, r]
        const mrFail = (tag: AstTag, sequence: AstSequence, r: Remainder): MatchResult => [{tag, sequence}, false, r]
        const {emptyTag, rangeMap} = rule
        if (cp.length === 0) {
            return mrSuccess(emptyTag, [], emptyTag === undefined ? null : cp)
        }
        const cp0 = cp[0]
        const dr = dispatchOp.get(cp0)(rangeMap)
        if (dr === null) {
            if (emptyTag === undefined) {
                return mrFail(emptyTag, [], cp)
            }
            return mrSuccess(emptyTag, [], cp)
        }
        let seq: AstSequence = [cp0]
        let r = cp
        const [_, ...restCp] = cp
        r = restCp
        const {tag, rules} = dr
        for (const i of rules) {
            const rule = typeof i === 'string' ? map[i] : i
            const res = f(rule, r)
            const [astRule, success, newR] = res
            if (success === false) {
                return res
            }
            seq = [...seq, astRule]
            if (newR === null) {
                return mrSuccess(tag, seq, null)
            }
            r = newR
        }
        return mrSuccess(tag, seq, r)
    }

    return (name, cp): MatchResult => f(map[name], cp)
}
