/**
 * LL(1) dispatch/matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fjs/bnf/data`, this is one member of the
 * family of automaton builders that consume a {@link RuleSet}: it compiles the
 * grammar into a predictive {@link dispatchMap} and matches input into an AST
 * ({@link MatchResult}). It throws at build time when the grammar is not
 * LL(1): `can not merge …` for a first/first conflict, `left recursion …` for
 * a rule reachable from itself in first position. Nullability is looked up
 * from {@link emptyTagMap} in `fjs/bnf/data` rather than re-derived here.
 *
 * A rule is entered *before* its first symbol is consumed: the dispatch map
 * only selects — a variant's branch, a repetition's next round — and every
 * rule invocation builds a node of its own, so the AST is the one
 * `fjs/bnf/descent` builds for the same grammar (see ./README.md). A `Repeat`
 * rule is matched iteratively and produces one node holding a flat sequence
 * of the items it matched.
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
 * @import { List } from '../../types/list/types.ts'
 * @import { RuleSet, Sequence } from '../data/types.ts'
 * @import { Rule as FRule } from '../types.ts'
 * @import { AstSequence, AstTag, Match, MatchResult, Remainder, _AstRule, _Dispatch, _DispatchBranch, _DispatchMap, _DispatchResult, _DispatchRule } from './types.ts'
 */

import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { rangeMap } from '../../types/range_map/module.f.mjs'
import { contains as rangeContains } from '../../types/range/module.f.mjs'
import { contains, set } from '../../types/string_set/module.f.mjs'
import { eofSymbol, rangeDecode } from '../module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { emptyTagMap, isRepeat, toData } from '../data/module.f.mjs'

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
 * Each rule's entry holds the rule's first set as a range map. Only a variant
 * reads the value under a symbol — the branch that lookahead selects; every
 * other reader asks whether a symbol is in the set at all, which is how a
 * repetition decides to start another round. `empty` is the branch a variant
 * takes when no entry matches the lookahead — its nullable branch, absent
 * when the variant cannot match empty.
 *
 * A rule referenced in first position while its own first set is still being
 * computed is left recursion — a grammar no lookahead can decide, whose match
 * would loop at the same position forever — so building throws
 * (`left recursion …`) rather than letting the matcher diverge. The one
 * self-reference with a sound reading is a repetition of itself: zero rounds
 * match whatever the item does, so it dispatches on nothing and matches empty.
 *
 * @type {(ruleSet: RuleSet) => _DispatchMap}
 */
export const dispatchMap = ruleSet => {

    const nullMap = emptyTagMap(ruleSet)

    /** @type {(dm: _DispatchMap, name: string, current: StringSet) => _DispatchMap} */
    const dispatchRule = (dm, name, current) => {
        if (name in dm) { return dm }
        const newCurrent = set(name)(current)
        const rule = ruleSet[name]
        /** @type {_DispatchRule} */
        let dr
        if (typeof rule === 'number') {
            dr = {
                empty: undefined,
                rangeMap: dispatchOp.fromRange({ tag: undefined, name })(rangeDecode(rule)),
            }
        } else if (rule instanceof Array) {
            // A sequence's first set is the union of its items' first sets up
            // to and including the first item that cannot match empty.
            /** @type {_Dispatch} */
            let first = []
            for (const item of rule) {
                if (contains(item)(newCurrent)) {
                    throw ['left recursion [', name, '][', item, ']']
                }
                dm = dispatchRule(dm, item, newCurrent)
                first = toArray(dispatchOp.merge(first)(assertNotNullish(dm[item]).rangeMap))
                if (nullMap[item] === undefined) { break }
            }
            dr = { empty: undefined, rangeMap: first }
        } else if (isRepeat(rule)) {
            // Zero rounds always match, so a repetition needs no `empty`
            // branch; its first set is its item's. A repetition of itself has
            // no first set to dispatch on, so it can only match zero rounds —
            // `toData` never derives one, but a hand-written rule set can.
            dm = contains(rule)(newCurrent) ? dm : dispatchRule(dm, rule, newCurrent)
            const itemDr = dm[rule]
            dr = { empty: undefined, rangeMap: itemDr === undefined ? [] : itemDr.rangeMap }
        } else {
            /** @type {_Dispatch} */
            let first = []
            /** @type {_DispatchBranch | undefined} */
            let empty = undefined
            for (const [tag, item] of definedEntries(rule)) {
                if (contains(item)(newCurrent)) {
                    throw ['left recursion [', name, '][', item, ']']
                }
                dm = dispatchRule(dm, item, newCurrent)
                /** @type {_Dispatch} */
                const d = assertNotNullish(dm[item]).rangeMap
                    .map(x => [x[0] === null ? null : { tag, name: item }, x[1]])
                first = toArray(dispatchOp.merge(first)(d))
                if (nullMap[item] !== undefined) {
                    empty = { tag, name: item }
                }
            }
            dr = { empty, rangeMap: first }
        }
        return { ...dm, [name]: dr }
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
 * A match position over the physical input: `0 .. cp.length` are the physical
 * positions, and `cp.length + 1` is where the one synthesized EOF has been
 * consumed.
 *
 * This is the `(idx, eofConsumed)` cursor written as one number: `eofConsumed`
 * can only be true at the physical end, so the pair and the extended position
 * hold the same information.
 *
 * @typedef {number} _Cursor
 */

/**
 * Where a match stopped: a {@link _Cursor}, or `null` when it ran out of input
 * — the `null` {@link Remainder} this backend reports for that.
 *
 * @typedef {_Cursor|null} _Position
 */

/**
 * The machine's own result: a {@link MatchResult} positioned by a cursor
 * instead of by a materialized remainder.
 *
 * @typedef {{
 *     readonly ast: _AstRule
 *     readonly success: boolean
 *     readonly pos: _Position
 * }} _Result
 */

/**
 * A suspended sequence match: `items[itemIndex]` is being matched by the
 * current task, and `seq` holds the ASTs of the items already matched.
 *
 * @typedef {{
 *     readonly kind: 'seq'
 *     readonly tag: AstTag
 *     readonly items: Sequence
 *     readonly itemIndex: number
 *     readonly seq: AstSequence
 * }} _SeqFrame
 */

/**
 * A suspended repetition: the item is being matched by the current task for
 * one more round, and `items` holds the ASTs of the rounds that already
 * completed. They accumulate as a list rather than an array because a
 * repetition is as long as its input: appending to an array per round would
 * copy the whole prefix each time and make one repetition quadratic in the
 * number of items it matched.
 *
 * @typedef {{
 *     readonly kind: 'repeat'
 *     readonly tag: AstTag
 *     readonly item: string
 *     readonly items: _Items
 * }} _RepeatFrame
 */

/** @typedef {List<_AstRule>} _Items */

/** @typedef {_SeqFrame | _RepeatFrame} _Frame */

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
 *     readonly kind: 'rule'
 *     readonly name: string
 *     readonly tag: AstTag
 *     readonly pos: _Cursor
 * }} _RuleTask
 */

/**
 * The next round of a repetition, about to be decided by lookahead. Both the
 * rule that introduces a repetition and the frame that finishes one of its
 * rounds go through this, so a round is set up in exactly one place.
 *
 * @typedef {{
 *     readonly kind: 'repeat'
 *     readonly tag: AstTag
 *     readonly item: string
 *     readonly items: _Items
 *     readonly pos: _Cursor
 * }} _RepeatTask
 */

/** @typedef {_RuleTask | _RepeatTask} _Task */

/** @type {(tag: AstTag, sequence: AstSequence, pos: _Position) => _Result} */
const mrSuccess = (tag, sequence, pos) =>
    ({ast: {tag, sequence}, success: true, pos})

/** @type {(tag: AstTag, sequence: AstSequence, pos: _Position) => _Result} */
const mrFail = (tag, sequence, pos) =>
    ({ast: {tag, sequence}, success: false, pos})

/**
 * The semantic symbol a cursor points at: a code point inside the physical
 * input, and the synthesized {@link eofSymbol} at its end. Only meaningful
 * where the cursor still has a symbol, `pos <= cp.length`.
 *
 * @type {(cp: readonly CodePoint[], pos: _Cursor) => number}
 */
const symbolAt = (cp, pos) => pos < cp.length ? cp[pos] : eofSymbol

/**
 * What consuming the symbol at a cursor contributes to the AST: the code point
 * itself, and nothing for the synthesized EOF — it has no physical source
 * element.
 *
 * @type {(cp: readonly CodePoint[], pos: _Cursor) => AstSequence}
 */
const leafAt = (cp, pos) => pos < cp.length ? [cp[pos]] : []

/**
 * The public remainder of a position. It stays physical, so consuming EOF
 * leaves it empty; the slice is materialized once, at the end of a match.
 *
 * @type {(cp: readonly CodePoint[], pos: _Position) => Remainder}
 */
const remainderAt = (cp, pos) => pos === null ? null : cp.slice(Math.min(pos, cp.length))

/**
 * Creates an LL(1) parser from an already materialized {@link RuleSet}.
 *
 * @type {(ruleSet: RuleSet) => Match}
 */
export const parserRuleSet = ruleSet => {
    const map = dispatchMap(ruleSet)

    /** @type {(name: string) => _DispatchRule} */
    const dispatched = name => assertNotNullish(map[name])

    // The matcher as an explicit-stack machine, the same shape as the sibling
    // `bnf/descent` matcher's: each iteration either starts the current task
    // (walking one rule of the grammar) or feeds the pending result into the
    // innermost frame. The JS call stack stays O(1) however deeply the grammar
    // recurses — nesting depth grows with input length, so a few thousand code
    // points used to overflow a recursive matcher (see the longInput proof
    // group). Positions are cursors into the shared input array for the same
    // reason: re-slicing the remainder per step made a match quadratic.
    //
    // Unlike `bnf/descent` it never backtracks: the dispatch map decides every
    // choice from the lookahead symbol, so a cursor only moves forward and no
    // frame needs rewind state.
    /** @type {(name: string, cp: readonly CodePoint[]) => MatchResult} */
    const f = (name, cp) => {
        /** @type {_Stack} */
        let stack = null
        /** @type {_Task|null} */
        let task = {kind: 'rule', name, tag: undefined, pos: 0}
        /** @type {_Result} */
        let result = mrFail(undefined, [], 0)

        while (true) {
            if (task !== null) {
                // The explicit cast cuts a control-flow inference cycle
                // (TS7022): `task`'s narrowed type feeds `pos`, which feeds the
                // `task` assignment below that the narrowing depends on.
                const current = /** @type {_Task} */ (task)
                task = null
                if (current.kind === 'repeat') {
                    const {tag, item, items, pos} = current
                    // One more round starts exactly while the lookahead is in
                    // the item's first set. Predictive selection cannot start a
                    // round that consumes nothing, so every round advances the
                    // cursor and the repetition always terminates.
                    if (pos <= cp.length && dispatchOp.get(dispatched(item).rangeMap)(symbolAt(cp, pos)) !== null) {
                        stack = {top: {kind: 'repeat', tag, item, items}, rest: stack}
                        task = {kind: 'rule', name: item, tag: undefined, pos}
                    } else {
                        result = mrSuccess(tag, toArray(items), pos)
                    }
                    continue
                }
                const {name, tag, pos} = current
                const rule = ruleSet[name]
                if (typeof rule === 'number') {
                    // The one logical EOF is available at the physical end, and
                    // only there: a terminal that matches it consumes it, once.
                    // Past it no symbol is left to consume.
                    if (pos <= cp.length && rangeContains(...rangeDecode(rule))(symbolAt(cp, pos))) {
                        result = mrSuccess(tag, leafAt(cp, pos), pos + 1)
                    } else if (pos >= cp.length) {
                        // Nothing left to reject: the match ran out of input.
                        result = mrSuccess(undefined, [], null)
                    } else {
                        result = mrFail(undefined, [], pos)
                    }
                } else if (rule instanceof Array) {
                    if (rule.length === 0) {
                        result = mrSuccess(tag, [], pos)
                    } else {
                        stack = {top: {kind: 'seq', tag, items: rule, itemIndex: 0, seq: []}, rest: stack}
                        task = {kind: 'rule', name: rule[0], tag: undefined, pos}
                    }
                } else if (isRepeat(rule)) {
                    task = {kind: 'repeat', tag, item: rule, items: null, pos}
                } else {
                    const {empty, rangeMap} = dispatched(name)
                    const d = pos > cp.length ? null : dispatchOp.get(rangeMap)(symbolAt(cp, pos))
                    const branch = d ?? empty
                    if (branch !== undefined) {
                        // The selected branch's node becomes the variant's,
                        // carrying the branch's tag — entered before its first
                        // symbol is consumed, like every rule invocation.
                        task = {kind: 'rule', name: branch.name, tag: branch.tag, pos}
                    } else if (pos >= cp.length) {
                        result = mrSuccess(undefined, [], null)
                    } else {
                        result = mrFail(undefined, [], pos)
                    }
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
            // A failing rule fails everything above it: LL(1) committed to
            // every choice on the way here, so there is nothing to rewind and
            // retry, and the failure propagates unchanged — its position is
            // where matching stopped.
            if (success === false) { continue }
            if (frame.kind === 'seq') {
                const seq = [...frame.seq, ast]
                if (pos === null) {
                    result = mrSuccess(frame.tag, seq, null)
                } else {
                    const itemIndex = frame.itemIndex + 1
                    if (itemIndex < frame.items.length) {
                        stack = {top: {...frame, itemIndex, seq}, rest: stack}
                        task = {kind: 'rule', name: frame.items[itemIndex], tag: undefined, pos}
                    } else {
                        result = mrSuccess(frame.tag, seq, pos)
                    }
                }
            } else {
                const items = concat(frame.items)([ast])
                if (pos === null) {
                    result = mrSuccess(frame.tag, toArray(items), null)
                } else {
                    task = {kind: 'repeat', tag: frame.tag, item: frame.item, items, pos}
                }
            }
        }
    }

    return f
}
