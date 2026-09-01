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
 * The caller passes metadata-bearing physical symbols; the matcher synthesizes
 * the one logical EOF after them, so a grammar can dispatch on the end of input
 * with the `eof` terminal. The position it does that at, the AST it builds, and the
 * constructors that pair them are the shared layer in `fjs/bnf/matcher`.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { Monoid } from '../../common/monoid/types.ts'
 * @import { Properties } from '../../types/range_map/types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { Rule as DataRule, RuleSet } from '../data/types.ts'
 * @import { Rule as FRule } from '../types.ts'
 * @import { AstTag, Meta, Out, RepeatTransformer, SequenceTransformer, TerminalTransformer, Transformer, VariantTransformer } from '../matcher/types.ts'
 * @import { Match, MatchResult, Remainder, Transformers, TransformMatch, _Dispatch, _DispatchBranch, _DispatchMap, _DispatchResult, _DispatchRule } from './types.ts'
 * @import { _Position, _Result, _Stack, _Task } from './private.ts'
 */

import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { rangeMap } from '../../types/range_map/module.f.mjs'
import { contains as rangeContains } from '../../types/range/module.f.mjs'
import { contains, set } from '../../types/string_set/module.f.mjs'
import { eofSymbol, rangeDecode } from '../module.f.mjs'
import { definedEntries, definedValues } from '../../types/object/module.f.mjs'
import { emptyTagMap, isRepeat, toData, toDataWithRules } from '../data/module.f.mjs'
import { astRepeat, astSequence, astTerminal, leafAt, mrFail, mrSuccess, physicalIdx, symbolAt, transformerTools } from '../matcher/module.f.mjs'

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
 * @template M
 * @param {FRule} fr
 * @returns {Match<M>}
 */
export const parser = fr => {
    const data = toData(fr)
    return parserRuleSet(data[0])
}

/**
 * A leaf here is the code point itself, so it *is* its own symbol. The
 * annotation pins `identity`'s type parameter, which `symbolAt`'s own cannot
 * infer from a fully generic argument.
 *
 * @type {<M>(leaf: Meta<M, CodePoint>) => number}
 */
const symbolOf = ([symbol]) => symbol

const symbolAtCp = symbolAt(symbolOf)

/**
 * The public remainder of a position. It stays physical, so consuming EOF
 * leaves it empty; the slice is materialized once, at the end of a match.
 *
 * @type {<M>(cp: readonly Meta<M, CodePoint>[], pos: _Position) => Remainder<M>}
 */
const remainderAt = (cp, pos) => pos === null ? null : cp.slice(physicalIdx(cp.length)(pos))

/**
 * Creates an LL(1) parser from an already materialized {@link RuleSet}.
 *
 * @template M
 * @param {RuleSet} ruleSet
 * @returns {Match<M>}
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
    /** @type {(name: string, cp: readonly Meta<M, CodePoint>[]) => MatchResult<M>} */
    const f = (name, cp) => {
        /** @type {_Stack<M>} */
        let stack = null
        /** @type {_Task<M>|null} */
        let task = {kind: 'rule', name, tag: undefined, pos: 0}
        /** @type {_Result<M>} */
        let result = mrFail(undefined, [], 0)

        while (true) {
            if (task !== null) {
                // The explicit cast cuts a control-flow inference cycle
                // (TS7022): `task`'s narrowed type feeds `pos`, which feeds the
                // `task` assignment below that the narrowing depends on.
                const current = /** @type {_Task<M>} */ (task)
                task = null
                if (current.kind === 'repeat') {
                    const {tag, item, items, pos} = current
                    // One more round starts exactly while the lookahead is in
                    // the item's first set. Predictive selection cannot start a
                    // round that consumes nothing, so every round advances the
                    // cursor and the repetition always terminates.
                    if (pos <= cp.length && dispatchOp.get(dispatched(item).rangeMap)(symbolAtCp(cp, pos)) !== null) {
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
                    if (pos <= cp.length && rangeContains(...rangeDecode(rule))(symbolAtCp(cp, pos))) {
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
                    const d = pos > cp.length ? null : dispatchOp.get(rangeMap)(symbolAtCp(cp, pos))
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

/** @type {(rule: DataRule) => 'terminal'|'sequence'|'variant'|'repeat'} */
const dataKind = rule => typeof rule === 'number'
    ? 'terminal'
    : rule instanceof Array
        ? 'sequence'
        : isRepeat(rule)
            ? 'repeat'
            : 'variant'

/** @type {(a: readonly string[], b: readonly string[]) => boolean} */
const sameKeys = (a, b) =>
    a.length === b.length
    && a.every(key => b.includes(key))
    && b.every(key => a.includes(key))

/**
 * Repetition fold for `unit`: consume every round, retain only its metadata.
 *
 * @type {<M>(monoid: Monoid<M>) => RepeatTransformer<M, unknown, M, undefined>}
 */
const unitRepeat = monoid => ({
    init: monoid.identity,
    update: (metadata, [, itemMetadata]) => monoid.operation(metadata)(itemMetadata),
    end: metadata => [undefined, metadata],
})

/**
 * Creates metadata-bound rule transformers for the LL(1) backend.
 *
 * The native {@link parserRuleSet} path remains independent: it preserves
 * metadata in AST leaves and needs no monoid. This factory is the semantic
 * path, where the monoid combines metadata at sequence boundaries and in the
 * default repetition transformer.
 *
 * @template M
 * @param {Monoid<M>} monoid
 * @returns {Transformers<M>}
 */
export const transformers = monoid => {
    const tools = transformerTools(monoid)
    const factory = tools.map().factory

    /** @type {Transformers<M>['build']} */
    const build = rest => start => {
        assert(rest.factory === factory && start.factory === factory, 'transformer factory mismatch')
        assert(!rest.entries.has(start.rule), 'start rule transformer is duplicated')

        const [ruleSet, entryName, names] = toDataWithRules(start.rule)
        const rulesByName = new Map([...names].map(([rule, name]) => [name, rule]))
        const all = new Map([...rest.entries, [start.rule, start.transformer]])

        for (const [rule, transformer] of all) {
            const name = names.get(rule)
            assert(name !== undefined, 'unreachable rule transformer')
            const dataRule = ruleSet[name]
            if (transformer[0] === 'unit') { continue }
            assert(transformer[0] === dataKind(dataRule), 'wrong rule transformer kind')
            if (transformer[0] === 'sequence') {
                assert(dataRule instanceof Array && transformer[1] === dataRule.length, 'wrong sequence transformer arity')
            } else if (transformer[0] === 'variant') {
                assert(
                    typeof dataRule === 'object'
                    && !(dataRule instanceof Array)
                    && sameKeys(transformer[1], definedEntries(dataRule).map(([tag]) => tag)),
                    'wrong variant transformer branches',
                )
            } else if (transformer[0] === 'repeat') {
                assert(
                    isRepeat(dataRule) && names.get(transformer[1]) === dataRule,
                    'wrong repeat transformer item',
                )
            }
        }

        for (const [name, dataRule] of definedEntries(ruleSet)) {
            if (dataKind(dataRule) !== 'variant') { continue }
            assert(typeof dataRule === 'object' && !(dataRule instanceof Array))
            const rule = assertNotNullish(rulesByName.get(name))
            const mapped = all.has(rule)
            assert(
                definedValues(dataRule).every(child =>
                    all.has(assertNotNullish(rulesByName.get(child))) === mapped),
                'mixed mapped and unmapped variant boundary',
            )
        }

        const byName = new Map([...all].map(([rule, transformer]) => [
            assertNotNullish(names.get(rule)),
            transformer,
        ]))
        const dispatch = dispatchMap(ruleSet)
        /** @type {(name: string) => _DispatchRule} */
        const dispatched = name => assertNotNullish(dispatch[name])
        /** @type {(name: string) => Transformer<M, unknown> | undefined} */
        const transformed = name => byName.get(name)
        const unitFold = unitRepeat(monoid)

        /** @type {TransformMatch<unknown, M>} */
        const match = cp => {
            /**
             * @typedef {{
             *     readonly kind: 'sequence'
             *     readonly tag: AstTag
             *     readonly transformer: Transformer<M, unknown> | undefined
             *     readonly items: readonly string[]
             *     readonly itemIndex: number
             *     readonly values: readonly unknown[]
             *     readonly metadata: M
             * }} _TransformSequenceFrame
             */
            /**
             * @typedef {{
             *     readonly kind: 'variant'
             *     readonly branch: string
             *     readonly transformer: Transformer<M, unknown>
             * }} _TransformVariantFrame
             */
            /**
             * @typedef {{
             *     readonly kind: 'repeat'
             *     readonly tag: AstTag
             *     readonly item: string
             *     readonly fold: RepeatTransformer<M, unknown, unknown, unknown>
             *     readonly state: unknown
             * }} _TransformRepeatFrame
             */
            /** @typedef {_TransformSequenceFrame | _TransformVariantFrame | _TransformRepeatFrame} _TransformFrame */
            /** @typedef {null | { readonly top: _TransformFrame, readonly rest: _TransformStack }} _TransformStack */
            /**
             * @typedef {{
             *     readonly kind: 'rule'
             *     readonly name: string
             *     readonly tag: AstTag
             *     readonly pos: number
             * } | {
             *     readonly kind: 'repeat'
             *     readonly tag: AstTag
             *     readonly item: string
             *     readonly fold: RepeatTransformer<M, unknown, unknown, unknown>
             *     readonly state: unknown
             *     readonly pos: number
             * }} _TransformTask
             */
            /**
             * @typedef {{
             *     readonly value: Out<M, unknown> | null
             *     readonly success: boolean
             *     readonly pos: number | null
             * }} _TransformResult
             */

            /** @type {_TransformStack} */
            let stack = null
            /** @type {_TransformTask | null} */
            let task = { kind: 'rule', name: entryName, tag: undefined, pos: 0 }
            /** @type {_TransformResult} */
            let result = { value: null, success: false, pos: 0 }

            while (true) {
                if (task !== null) {
                    const current = /** @type {_TransformTask} */ (task)
                    task = null
                    if (current.kind === 'repeat') {
                        const { tag, item, fold, state, pos } = current
                        if (pos <= cp.length && dispatchOp.get(dispatched(item).rangeMap)(symbolAtCp(cp, pos)) !== null) {
                            stack = { top: { kind: 'repeat', tag, item, fold, state }, rest: stack }
                            task = { kind: 'rule', name: item, tag: undefined, pos }
                        } else {
                            result = { value: fold.end(state), success: true, pos }
                        }
                        continue
                    }

                    const { name, tag, pos } = current
                    const dataRule = ruleSet[name]
                    const transformer = transformed(name)
                    if (typeof dataRule === 'number') {
                        if (pos <= cp.length && rangeContains(...rangeDecode(dataRule))(symbolAtCp(cp, pos))) {
                            const input = pos < cp.length
                                ? cp[pos]
                                : /** @type {const} */ ([eofSymbol, monoid.identity])
                            /** @type {Out<M, unknown>} */
                            let value
                            if (transformer === undefined) {
                                value = astTerminal(tag)(input)
                            } else if (transformer[0] === 'unit') {
                                value = [undefined, input[1]]
                            } else {
                                assert(transformer[0] === 'terminal')
                                const transform = /** @type {TerminalTransformer<M, unknown>} */ (transformer[1])
                                value = transform(input)
                            }
                            result = { value, success: true, pos: pos + 1 }
                        } else if (pos >= cp.length) {
                            result = { value: null, success: true, pos: null }
                        } else {
                            result = { value: null, success: false, pos }
                        }
                    } else if (dataRule instanceof Array) {
                        if (dataRule.length === 0) {
                            const input = /** @type {const} */ ([[], monoid.identity])
                            /** @type {Out<M, unknown>} */
                            let value
                            if (transformer === undefined) {
                                value = astSequence(tag)(input)
                            } else if (transformer[0] === 'unit') {
                                value = [undefined, monoid.identity]
                            } else {
                                assert(transformer[0] === 'sequence')
                                const transform = /** @type {SequenceTransformer<M, readonly unknown[], unknown>} */ (transformer[2])
                                value = transform(input)
                            }
                            result = { value, success: true, pos }
                        } else {
                            stack = { top: {
                                kind: 'sequence', tag, transformer,
                                items: dataRule, itemIndex: 0, values: [],
                                metadata: monoid.identity,
                            }, rest: stack }
                            task = { kind: 'rule', name: dataRule[0], tag: undefined, pos }
                        }
                    } else if (isRepeat(dataRule)) {
                        /** @type {RepeatTransformer<M, unknown, any, unknown>} */
                        let fold
                        if (transformer === undefined) {
                            fold = astRepeat(monoid)(tag)
                        } else if (transformer[0] === 'unit') {
                            fold = unitFold
                        } else {
                            assert(transformer[0] === 'repeat')
                            fold = /** @type {any} */ (transformer[2])
                        }
                        task = { kind: 'repeat', tag, item: dataRule, fold, state: fold.init, pos }
                    } else {
                        const { empty, rangeMap } = dispatched(name)
                        const selected = pos > cp.length ? null : dispatchOp.get(rangeMap)(symbolAtCp(cp, pos))
                        const branch = selected ?? empty
                        if (branch === undefined) {
                            result = pos >= cp.length
                                ? { value: null, success: true, pos: null }
                                : { value: null, success: false, pos }
                        } else if (transformer === undefined) {
                            task = { kind: 'rule', name: branch.name, tag: branch.tag, pos }
                        } else {
                            stack = { top: {
                                kind: 'variant', branch: assertNotNullish(branch.tag), transformer,
                            }, rest: stack }
                            task = { kind: 'rule', name: branch.name, tag: undefined, pos }
                        }
                    }
                    continue
                }

                if (stack === null) {
                    if (result.pos === null) { return ['no-match', null] }
                    const remainder = cp.slice(physicalIdx(cp.length)(result.pos))
                    return result.success
                        ? ['ok', assertNotNullish(result.value), remainder]
                        : ['no-match', remainder]
                }

                const frame = stack.top
                stack = stack.rest
                if (result.pos === null) { return ['no-match', null] }
                if (result.success === false) { continue }
                const [value, metadata] = assertNotNullish(result.value)

                if (frame.kind === 'sequence') {
                    const values = [...frame.values, value]
                    const combined = monoid.operation(frame.metadata)(metadata)
                    const itemIndex = frame.itemIndex + 1
                    if (itemIndex < frame.items.length) {
                        stack = { top: { ...frame, itemIndex, values, metadata: combined }, rest: stack }
                        task = { kind: 'rule', name: frame.items[itemIndex], tag: undefined, pos: result.pos }
                    } else {
                        const input = /** @type {const} */ ([values, combined])
                        const transformer = frame.transformer
                        /** @type {Out<M, unknown>} */
                        let output
                        if (transformer === undefined) {
                            output = astSequence(frame.tag)(input)
                        } else if (transformer[0] === 'unit') {
                            output = [undefined, combined]
                        } else {
                            assert(transformer[0] === 'sequence')
                            const transform = /** @type {SequenceTransformer<M, readonly unknown[], unknown>} */ (transformer[2])
                            output = transform(input)
                        }
                        result = { value: output, success: true, pos: result.pos }
                    }
                } else if (frame.kind === 'variant') {
                    const input = /** @type {const} */ ([[frame.branch, value], metadata])
                    /** @type {Out<M, unknown>} */
                    let output
                    if (frame.transformer[0] === 'unit') {
                        output = [undefined, metadata]
                    } else {
                        assert(frame.transformer[0] === 'variant')
                        const transform = /** @type {VariantTransformer<M, {readonly[k: string]: unknown}, unknown>} */ (frame.transformer[2])
                        output = transform(input)
                    }
                    result = { value: output, success: true, pos: result.pos }
                } else {
                    const state = frame.fold.update(frame.state, [value, metadata])
                    task = {
                        kind: 'repeat', tag: frame.tag, item: frame.item,
                        fold: frame.fold, state, pos: result.pos,
                    }
                }
            }
        }

        return /** @type {TransformMatch<any, M>} */ (match)
    }

    return { ...tools, build }
}
