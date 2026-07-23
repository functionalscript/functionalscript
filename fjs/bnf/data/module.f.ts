/**
 * The serializable BNF intermediate representation (IR) and the
 * {@link toData} conversion from the functional grammar.
 *
 * This module is the pure, parser-agnostic substrate: it defines the
 * {@link RuleSet} data form (`Rule = Variant | Sequence | TerminalRange`) and
 * converts a functional grammar into it. The automaton builders that consume a
 * {@link RuleSet} live in their own sibling modules (`fjs/bnf/ll1`,
 * `fjs/bnf/descent`, …), so the IR stays free of any one parser's machinery.
 *
 * @module
 */
import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import {
    oneEncode,
    type DataRule,
    type Rule as FRule,
    type Sequence as FSequence,
} from '../module.f.ts'
import { definedEntries, type StringMap } from '../../types/object/module.f.ts'

/**
 * Encoded terminal range value used by BNF data rules.
 *
 * The same as the functional TerminalRange.
 */
export type TerminalRange = number

/**
 * Ordered list of grammar rule names.
 */
export type Sequence = readonly string[]

/** A variant of rule names. */
export type Variant = StringMap<string, string>

/**
 * Grammar rule definition.
 *
 * It can be one of:
 * - a tagged variant map,
 * - a sequence of referenced rule names,
 * - an encoded terminal range.
 */
export type Rule = Variant | Sequence | TerminalRange

/** The full grammar */
export type RuleSet = Readonly<Record<string, Rule>>

/**
 * Whether a rule can match empty input: `undefined` if it never can, `true`
 * if it can with no tag (a nullable sequence), or the tag of the nullable
 * variant branch.
 */
export type EmptyTag = string | true | undefined

type EmptyTagMap = StringMap<string, EmptyTag>

const emptyTagOf = (map: EmptyTagMap) => (rule: Rule): EmptyTag => {
    if (typeof rule === 'number') {
        return undefined
    } else if (rule instanceof Array) {
        return rule.every(item => map[item] !== undefined) ? true : undefined
    } else {
        let tag: EmptyTag = undefined
        for (const [k, item] of definedEntries(rule)) {
            if (map[item] !== undefined) {
                tag = k
            }
        }
        return tag
    }
}

const emptyTagStep = (ruleSet: RuleSet) => (map: EmptyTagMap): readonly [EmptyTagMap, boolean] => {
    let next = map
    let changed = false
    for (const name in ruleSet) {
        const tag = emptyTagOf(map)(ruleSet[name])
        if (tag !== next[name]) {
            changed = true
        }
        next = { ...next, [name]: tag }
    }
    return [next, changed]
}

/**
 * Computes, for every rule in the set, whether it can match empty input, by
 * the standard nullable-set fixpoint: a sequence is nullable iff all of its
 * items are (AND semantics), a variant iff at least one branch is (its tag is
 * that branch's). Rules may reference each other cyclically (e.g. a `repeat`
 * rule referring to itself), so this starts every rule as non-nullable and
 * relaxes every rule, one round at a time, until a full round changes
 * nothing. A round only ever grows the nullable set or moves a variant's
 * chosen tag to a later (still-nullable) branch, both bounded, so this always
 * terminates — but a rule's tag can still change for rounds *after* its own
 * nullable/non-nullable status has already settled, while a cyclic
 * dependency's tag catches up, so a fixed round count isn't enough.
 */
export const emptyTagMap = (ruleSet: RuleSet): EmptyTagMap => {
    const step = emptyTagStep(ruleSet)
    const relax = (map: EmptyTagMap): EmptyTagMap => {
        const [next, changed] = step(map)
        return changed ? relax(next) : next
    }
    return relax({})
}

//

type FRuleMap = StringMap<string, FRule>

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

/**
 * Converts a functional grammar rule into serializable BNF data and returns
 * the generated rule set with the entry rule identifier.
 */
export const toData = (fr: FRule): readonly [RuleSet, string] => {
    const [, ruleSet, id] = toDataAdd({})(fr)
    return [ruleSet, id]
}
