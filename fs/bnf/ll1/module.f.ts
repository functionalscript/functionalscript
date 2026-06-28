/**
 * LL(1) dispatch/matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fs/bnf/data`, this is one member of the
 * family of automaton builders that consume a {@link RuleSet}: it compiles the
 * grammar into a predictive {@link dispatchMap} and matches input into an AST
 * ({@link MatchResult}). It throws at build time (`can not merge …`) when the
 * grammar is not LL(1) — a first/first conflict.
 *
 * @module
 */
import { type CodePoint } from '../../text/utf16/module.f.ts'
import { strictEqual } from '../../types/function/operator/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { rangeMap, type RangeMapArray } from '../../types/range_map/module.f.ts'
import { contains, set, type StringSet } from '../../types/string_set/module.f.ts'
import { rangeDecode } from '../module.f.ts'
import { definedEntries, type StringMap } from '../../types/object/module.f.ts'
import { type RuleSet, toData } from '../data/module.f.ts'
import { type Rule as FRule } from '../module.f.ts'

type EmptyTag = string|true|undefined

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

type DispatchMap = StringMap<string, DispatchRule>

/**
 * Represents a parsed AST sequence.
 */
export type AstSequence = readonly(AstRule|CodePoint)[]

export type AstTag = string|true|undefined

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
 * Parsing result of {@link parser} and {@link parserRuleSet}.
 *
 * Represents the result of a match operation, including the parsed AST rule and the remainder of the input.
 */
export type MatchResult = readonly[AstRule, boolean, Remainder]

/**
 * LL(1) parser function for matching by rule name.
 */
export type Match = (name: string, s: readonly CodePoint[]) => MatchResult

/**
 * Internal match function signature used by compiled dispatch rules.
 */
export type MatchRule = (dr: DispatchRule, s: readonly CodePoint[]) => MatchResult

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

/**
 * Builds a dispatch map for a {@link RuleSet} to enable predictive parsing.
 */
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
                    const dr = dm[item]!
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
            const entries = definedEntries(rule)
            let result: Dispatch = []
            let emptyTag: EmptyTag = undefined
            for (const [tag, item] of entries) {
                dm = dispatchRule(dm, item, newCurrent)
                const dr = dm[item]!
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

/**
 * Creates an LL(1) parser from a functional grammar rule.
 */
export const parser = (fr: FRule): Match => {
    const data = toData(fr)
    return parserRuleSet(data[0])
}

/**
 * Creates an LL(1) parser from an already materialized {@link RuleSet}.
 */
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
        const [_, ...restCp] = cp
        let r: readonly number[] = restCp
        const {tag, rules} = dr
        for (const i of rules) {
            const rule = typeof i === 'string' ? map[i]! : i
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

    return (name, cp): MatchResult => f(map[name]!, cp)
}
