/**
 * LL(1) dispatch/matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fjs/bnf/data`, this is one member of the
 * family of automaton builders that consume a {@link RuleSet}: it compiles the
 * grammar into a predictive {@link dispatchMap} and matches input into an AST
 * ({@link MatchResult}). It throws at build time (`can not merge …`) when the
 * grammar is not LL(1) — a first/first conflict. Nullability is looked up from
 * {@link emptyTagMap} in `fjs/bnf/data` rather than re-derived here.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 */
import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { rangeMap } from '../../types/range_map/module.f.mjs'
/** @import { Properties } from '../../types/range_map/types.ts' */
import { contains, set } from '../../types/string_set/module.f.mjs'
/** @import { StringSet } from '../../types/string_set/types.ts' */
import { rangeDecode } from '../module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { emptyTagMap, toData } from '../data/module.f.mjs'
/** @import { EmptyTag, RuleSet } from '../data/types.ts' */
/** @import { Rule as FRule } from '../types.ts' */
/** @import { AstSequence, AstTag, Match, MatchResult, MatchRule, Remainder, _Dispatch, _DispatchMap, _DispatchResult, _DispatchRule } from './types.ts' */

/** @type {Properties<_DispatchResult>} */
const dispatchProps = {
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
}

const dispatchOp = rangeMap(dispatchProps)

/**
 * Builds a dispatch map for a {@link RuleSet} to enable predictive parsing.
 *
 * @type {(ruleSet: RuleSet) => _DispatchMap}
 */
export const dispatchMap = ruleSet => {

    const nullMap = emptyTagMap(ruleSet)

    /** @type {(dr: _DispatchResult, name: string) => _DispatchResult} */
    const addRuleToDispatch = (dr, name) => {
        if (dr === null)
            return null

        return { tag: dr.tag, rules: [...dr.rules, name]}
    }

    /** @type {(dr: _DispatchResult, tag: string) => _DispatchResult} */
    const addTagToDispatch = (dr, tag) => {
        if (dr === null)
            return null

        return { tag, rules: dr.rules}
    }

    /** @type {(dm: _DispatchMap, name: string, current: StringSet) => _DispatchMap} */
    const dispatchRule = (dm, name, current) => {
        if (name in dm) { return dm }
        const newCurrent = set(name)(current)
        const rule = ruleSet[name]
        if (typeof rule === 'number') {
            const range = rangeDecode(rule)
            const dispatch = dispatchOp.fromRange({tag: undefined, rules: []})(range)
            /** @type {_DispatchRule} */
            const dr = {emptyTag: undefined, rangeMap: dispatch}
            return { ...dm, [name]: dr }
        } else if (rule instanceof Array) {
            /** @type {EmptyTag} */
            let emptyTag = true
            /** @type {_Dispatch} */
            let result = []
            for (const item of rule) {
                if (contains(item)(newCurrent)) {
                    result = result.map(x => [addRuleToDispatch(x[0], item), x[1]])
                } else {
                    dm = dispatchRule(dm, item, newCurrent)
                    const dr = /** @type {_DispatchRule} */ (dm[item])
                    if (emptyTag === true) {
                        result = result.map(x => [addRuleToDispatch(x[0], item), x[1]])
                        result = toArray(dispatchOp.merge(result)(dr.rangeMap))
                        emptyTag = nullMap[item] !== undefined ? true : undefined
                    } else {
                        result = result.map(x => [addRuleToDispatch(x[0], item), x[1]])
                    }
                }
            }
            /** @type {_DispatchRule} */
            const dr = {emptyTag, rangeMap: result}
            return { ...dm, [name]: dr}
        } else {
            const entries = definedEntries(rule)
            /** @type {_Dispatch} */
            let result = []
            /** @type {EmptyTag} */
            let emptyTag = undefined
            for (const [tag, item] of entries) {
                dm = dispatchRule(dm, item, newCurrent)
                const dr = /** @type {_DispatchRule} */ (dm[item])
                if (nullMap[item] !== undefined) {
                    emptyTag = tag
                } else {
                    /** @type {_Dispatch} */
                    const d = dr.rangeMap.map(x => [addTagToDispatch(x[0], tag), x[1]])
                    result = toArray(dispatchOp.merge(result)(d))
                }
            }
            /** @type {_DispatchRule} */
            const dr = {emptyTag, rangeMap: result}
            return { ...dm, [name]: dr}
        }
    }

    /** @type {_DispatchMap} */
    let result = {}
    for (const k in ruleSet) {
        result = dispatchRule(result, k, null)
    }

    return result
}

/**
 * Creates an LL(1) parser from a functional grammar rule.
 *
 * @type {(fr: FRule) => Match}
 */
export const parser = fr => {
    const data = toData(fr)
    return parserRuleSet(data[0])
}

/** @type {(tag: AstTag, sequence: AstSequence, r: Remainder) => MatchResult} */
const mrSuccess = (tag, sequence, r) =>
    [{tag, sequence}, true, r]

/** @type {(tag: AstTag, sequence: AstSequence, r: Remainder) => MatchResult} */
const mrFail = (tag, sequence, r) =>
    [{tag, sequence}, false, r]

/**
 * Creates an LL(1) parser from an already materialized {@link RuleSet}.
 *
 * @type {(ruleSet: RuleSet) => Match}
 */
export const parserRuleSet = ruleSet => {
    const map = dispatchMap(ruleSet)

    /** @type {MatchRule} */
    const f = ({emptyTag, rangeMap}, cp) => {
        if (cp.length === 0) {
            return mrSuccess(emptyTag, [], emptyTag === undefined ? null : cp)
        }
        const [cp0] = cp
        const dr = dispatchOp.get(rangeMap)(cp0)
        if (dr === null) {
            return emptyTag === undefined
                ? mrFail(emptyTag, [], cp)
                : mrSuccess(emptyTag, [], cp)
        }
        /** @type {AstSequence} */
        let seq = [cp0]
        const [, ...restCp] = cp
        /** @type {readonly number[]} */
        let r = restCp
        const {tag, rules} = dr
        for (const i of rules) {
            const rule = typeof i === 'string' ? /** @type {_DispatchRule} */ (map[i]) : i
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

    return (name, cp) => f(/** @type {_DispatchRule} */ (map[name]), cp)
}
