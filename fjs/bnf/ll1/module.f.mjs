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
 * The caller passes physical symbols only; the matcher synthesizes the one
 * logical EOF ({@link eofSymbol}) after them, so a grammar can dispatch on the
 * end of input with the `eof` terminal.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { Properties } from '../../types/range_map/types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { EmptyTag, RuleSet } from '../data/types.ts'
 * @import { Rule as FRule } from '../types.ts'
 * @import { AstSequence, AstTag, Match, MatchResult, MatchRule, Remainder, _Dispatch, _DispatchMap, _DispatchResult, _DispatchRule, _DispatchRuleCollection, _MatchResultEof } from './types.ts'
 */

import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { rangeMap } from '../../types/range_map/module.f.mjs'
import { contains, set } from '../../types/string_set/module.f.mjs'
import { eofSymbol, rangeDecode } from '../module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { emptyTagMap, toData } from '../data/module.f.mjs'

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

    // Matches the rules the dispatched symbol selected, one after another,
    // starting from `seq0` — the AST of that symbol, empty when it was the
    // synthesized EOF.
    /** @type {(d: _DispatchRuleCollection, seq0: AstSequence, cp: readonly CodePoint[], eofConsumed: boolean) => _MatchResultEof} */
    const items = ({tag, rules}, seq0, cp, eofConsumed) => {
        let seq = seq0
        let r = cp
        let eofDone = eofConsumed
        for (const i of rules) {
            const rule = typeof i === 'string' ? /** @type {_DispatchRule} */ (map[i]) : i
            const [res, itemEof] = f(rule, r, eofDone)
            const [astRule, success, newR] = res
            if (success === false) {
                return [res, itemEof]
            }
            seq = [...seq, astRule]
            eofDone = itemEof
            if (newR === null) {
                return [mrSuccess(tag, seq, null), eofDone]
            }
            r = newR
        }
        return [mrSuccess(tag, seq, r), eofDone]
    }

    /** @type {MatchRule} */
    const f = ({emptyTag, rangeMap}, cp, eofConsumed) => {
        if (cp.length === 0) {
            // The one logical EOF is available at the physical end, and only
            // there: a rule that dispatches on it consumes it, once.
            const eofDr = eofConsumed ? null : dispatchOp.get(rangeMap)(eofSymbol)
            if (eofDr === null) {
                return [mrSuccess(emptyTag, [], emptyTag === undefined ? null : cp), eofConsumed]
            }
            // The synthesized EOF has no physical source element, so it adds no
            // AST leaf, and the remainder stays physical — already empty here.
            return items(eofDr, [], cp, true)
        }
        const [cp0] = cp
        const dr = dispatchOp.get(rangeMap)(cp0)
        if (dr === null) {
            return [
                emptyTag === undefined
                    ? mrFail(emptyTag, [], cp)
                    : mrSuccess(emptyTag, [], cp),
                eofConsumed,
            ]
        }
        const [, ...restCp] = cp
        return items(dr, [cp0], restCp, eofConsumed)
    }

    return (name, cp) => f(/** @type {_DispatchRule} */ (map[name]), cp, false)[0]
}
