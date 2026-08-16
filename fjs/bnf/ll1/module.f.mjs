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
 * logical EOF after them, so a grammar can dispatch on the end of input with
 * the `eof` terminal. The position it does that at, the AST it builds, and the
 * constructors that pair them are the shared layer in `fjs/bnf/matcher`.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { Properties } from '../../types/range_map/types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { EmptyTag, RuleSet } from '../data/types.ts'
 * @import { AstResult, AstSequence, AstTag, Cursor } from '../matcher/types.ts'
 * @import { Rule as FRule } from '../types.ts'
 * @import { Match, MatchResult, Remainder, _Dispatch, _DispatchMap, _DispatchResult, _DispatchRule } from './types.ts'
 */

import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { rangeMap } from '../../types/range_map/module.f.mjs'
import { contains, set } from '../../types/string_set/module.f.mjs'
import { rangeDecode } from '../module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { emptyTagMap, isRepeat, toData } from '../data/module.f.mjs'
import { leafAt, mrFail, mrSuccess, physicalIdx, symbolAt } from '../matcher/module.f.mjs'

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
                    const dr = assertNotNullish(dm[item])
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
        } else if (isRepeat(rule)) {
            // A repetition dispatches exactly like the right-recursive variant it
            // was folded from: on the item's own first set, matching the item and
            // then this rule again. This backend inlines the first set of a
            // nullable item into whatever encloses it, so the repetition has to
            // stay expressible as a rules chain — see ./README.md.
            const item = rule
            if (contains(item)(newCurrent)) {
                /** @type {_DispatchRule} */
                const dr = {emptyTag: true, rangeMap: []}
                return { ...dm, [name]: dr }
            }
            dm = dispatchRule(dm, item, newCurrent)
            const itemDr = assertNotNullish(dm[item])
            /** @type {_Dispatch} */
            const rangeMap = itemDr.rangeMap.map(x => [addRuleToDispatch(x[0], name), x[1]])
            /** @type {_DispatchRule} */
            const dr = {emptyTag: true, rangeMap}
            return { ...dm, [name]: dr }
        } else {
            const entries = definedEntries(rule)
            /** @type {_Dispatch} */
            let result = []
            /** @type {EmptyTag} */
            let emptyTag = undefined
            for (const [tag, item] of entries) {
                dm = dispatchRule(dm, item, newCurrent)
                const dr = assertNotNullish(dm[item])
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

/**
 * Where a match stopped: a {@link Cursor}, or `null` when it ran out of input —
 * the `null` {@link Remainder} this backend reports for that.
 *
 * @typedef {Cursor|null} _Position
 */

/**
 * The machine's own result: a {@link MatchResult} positioned by a cursor
 * instead of by a materialized remainder.
 *
 * @typedef {AstResult<CodePoint, _Position>} _Result
 */

/**
 * A suspended rules-chain match: `rules[ruleIndex]` is being matched by the
 * current task, and `seq` holds the ASTs matched so far — starting with the
 * dispatched symbol's leaf, empty when that symbol was the synthesized EOF.
 *
 * @typedef {{
 *     readonly tag: AstTag
 *     readonly rules: readonly string[]
 *     readonly ruleIndex: number
 *     readonly seq: AstSequence<CodePoint>
 * }} _Frame
 */

/**
 * Immutable cons-cell stack: O(1) push/pop, no array copying per step.
 *
 * @typedef {null | {
 *     readonly top: _Frame
 *     readonly rest: _Stack
 * }} _Stack
 */

/**
 * The rule invocation about to be evaluated, or `null` when a result is ready
 * to resume the innermost frame instead.
 *
 * @typedef {{
 *     readonly rule: _DispatchRule
 *     readonly pos: Cursor
 * }} _Task
 */

/**
 * A leaf here is the code point itself, so it *is* its own symbol. The
 * annotation pins `identity`'s type parameter, which `symbolAt`'s own cannot
 * infer from a fully generic argument.
 *
 * @type {(leaf: CodePoint) => number}
 */
const symbolOf = identity

const symbolAtCp = symbolAt(symbolOf)

/**
 * The public remainder of a position. It stays physical, so consuming EOF
 * leaves it empty; the slice is materialized once, at the end of a match.
 *
 * @type {(cp: readonly CodePoint[], pos: _Position) => Remainder}
 */
const remainderAt = (cp, pos) => pos === null ? null : cp.slice(physicalIdx(cp.length)(pos))

/**
 * Creates an LL(1) parser from an already materialized {@link RuleSet}.
 *
 * @type {(ruleSet: RuleSet) => Match}
 */
export const parserRuleSet = ruleSet => {
    const map = dispatchMap(ruleSet)

    /** @type {(name: string) => _DispatchRule} */
    const dispatched = name => assertNotNullish(map[name])

    // The matcher as an explicit-stack machine: each iteration either starts the
    // current task (dispatching one rule and pushing a frame for the rules chain
    // that symbol selected) or feeds the pending result into the innermost frame.
    // Semantics are identical to the former recursive matcher, but the JS call
    // stack stays O(1) however deep the grammar recurses: a right-recursive rule
    // (e.g. a `repeat0Plus` chain) descends once per consumed code point, so the
    // depth used to grow with input length and overflow (see the longInput proof
    // group). Positions are cursors into the shared input array for the same
    // reason: re-slicing the remainder per step made a match quadratic.
    /** @type {(dr0: _DispatchRule, cp: readonly CodePoint[]) => MatchResult} */
    const f = (dr0, cp) => {
        /** @type {_Stack} */
        let stack = null
        /** @type {_Task|null} */
        let task = {rule: dr0, pos: 0}
        /** @type {_Result} */
        let result = mrFail(undefined, [], 0)

        while (true) {
            if (task !== null) {
                // The explicit annotation cuts a control-flow inference cycle
                // (TS7022): `task`'s narrowed type feeds `pos`, which feeds the
                // `task` assignment below that the narrowing depends on.
                /** @type {_Task} */
                const current = task
                const {rule: {emptyTag, rangeMap}, pos} = current
                task = null
                // The one logical EOF is available at the physical end, and only
                // there: a rule that dispatches on it consumes it, once. Past it
                // no symbol is left to dispatch on.
                const dr = pos > cp.length ? null : dispatchOp.get(rangeMap)(symbolAtCp(cp, pos))
                if (dr === null) {
                    if (emptyTag !== undefined) {
                        result = mrSuccess(emptyTag, [], pos)
                    } else if (pos >= cp.length) {
                        // Nothing left to reject: the match ran out of input.
                        result = mrSuccess(emptyTag, [], null)
                    } else {
                        result = mrFail(emptyTag, [], pos)
                    }
                    continue
                }
                const {tag, rules} = dr
                const seq = leafAt(cp, pos)
                const next = pos + 1
                if (rules.length === 0) {
                    result = mrSuccess(tag, seq, next)
                } else {
                    stack = {top: {tag, rules, ruleIndex: 0, seq}, rest: stack}
                    task = {rule: dispatched(rules[0]), pos: next}
                }
                continue
            }

            if (stack === null) {
                const {ast, success, pos} = result
                return [ast, success, remainderAt(cp, pos)]
            }
            const frame = stack.top
            stack = stack.rest

            const {ast, success, pos} = result
            // A failing item's own result propagates unchanged, exactly as the
            // recursive version returned it through the chain.
            if (success === false) { continue }
            const seq = [...frame.seq, ast]
            if (pos === null) {
                result = mrSuccess(frame.tag, seq, null)
                continue
            }
            const ruleIndex = frame.ruleIndex + 1
            if (ruleIndex < frame.rules.length) {
                stack = {top: {...frame, ruleIndex, seq}, rest: stack}
                task = {rule: dispatched(frame.rules[ruleIndex]), pos}
            } else {
                result = mrSuccess(frame.tag, seq, pos)
            }
        }
    }

    return (name, cp) => f(dispatched(name), cp)
}
