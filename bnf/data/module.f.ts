import { todo } from '../../dev/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { strictEqual } from '../../types/function/operator/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { fromRange, rangeMap, type RangeMapArray } from '../../types/range_map/module.f.ts'
import { isEmpty } from '../module.f.ts'
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

type DispatchRule = {
    readonly emptyTag: string|true|undefined,
    readonly rangeMap: Dispatch
}

type Dispatch = RangeMapArray<DispatchResult>

type DispatchResult = DispatchRuleCollection | null

type DispatchRuleCollection = {
    readonly tag: string | undefined,
    readonly rules: DispatchRule[]
}

type DispatchMap = { readonly[id in string]: DispatchRule }

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
    // const dispatchSequence = (dm: DispatchMap, sequence: RuleSequence): [DispatchMap, DispatchRule] => {
    //     let empty = true
    //     let result: Dispatch = []
    //     for (const item of sequence) {
    //         if (typeof item === 'string') {
    //             dm = dispatchRule(dm, item)
    //             const [e, dispatch] = dm[item]
    //             result = toArray(dispatchOp.merge
    //                 (result)
    //                 (dispatch.map(x => [x[0] === null ? null : sequence, x[1]])))
    //             if (e) {
    //                 continue
    //             }
    //         } else if (typeof item === 'number') {
    //             const rangeDecoded = rangeDecode(item)
    //             const dispatch = dispatchOp.fromRange(rangeDecoded)(sequence)
    //             result = toArray(dispatchOp.merge(result)(dispatch))
    //         } else {
    //             todo() //for variant
    //         }
    //     }
    //     return todo()
    // }

    const addRuleToDispatch = (dr: DispatchResult, rule: DispatchRule): DispatchResult => {
        if (dr === null)
            return null

        return { tag: dr.tag, rules: [...dr.rules, rule]}
    }

    const dispatchRule = (dm: DispatchMap, name: string): DispatchMap => {
        if (name in dm) { return dm }
        let emptyTag = undefined        
        const rule = ruleSet[name]
        if (typeof rule === 'number') {
            const range = rangeDecode(rule)            
            const dispatch = dispatchOp.fromRange(range)({tag: undefined, rules: []})
            const dr: DispatchRule = {emptyTag, rangeMap: dispatch}
            return { ...dm, [name]: dr }
        } else if (rule instanceof Array) {
            let result: Dispatch = []
            for (const item of rule) {
                dm = dispatchRule(dm, item)
                const dr = dm[item]
                if (emptyTag === undefined) {                    
                    result = toArray(dispatchOp.merge(result)(dr.rangeMap))
                    emptyTag = dm.emptyTag
                } else {
                    result = result.map(x => [addRuleToDispatch(x[0], dr), x[1]])
                }
            }
        }
        return todo()
    }

    let result: DispatchMap = {}
    for (const k in ruleSet) {
        result = dispatchRule(result, k)
    }
    
    return result
}

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
