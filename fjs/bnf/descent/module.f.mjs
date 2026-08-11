/**
 * Recursive descent matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fjs/bnf/data`, this is a sibling of the
 * LL(1) dispatch builder (`fjs/bnf/ll1`). It walks the grammar by recursive
 * descent and preserves per-code-point metadata, producing a metadata-aware
 * AST ({@link AstRuleMeta}). Nullability (which rule can match empty input) is
 * computed once by {@link emptyTagMap} in `fjs/bnf/data`.
 *
 * A failed result also carries a {@link DescentFailure}: the furthest position a
 * terminal was rejected at, which — unlike the result's own index — never
 * rewinds and is what diagnostics should be built from.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 */
import { rangeDecode } from '../module.f.mjs'
/** @import { TerminalRange } from '../types.ts' */
import { contains as rangeContains } from '../../types/range/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { emptyTagMap, toData } from '../data/module.f.mjs'
/** @import { Rule as DataRule, Sequence } from '../data/types.ts' */
/** @import { Rule as FRule } from '../types.ts' */
/** @import { AstTag, AstSequenceMeta, DescentFailure, DescentMatch, DescentMatchResult, DescentMatchRule } from './types.ts' */

/**
 * Folds one rejected terminal into the furthest-failure record: further along
 * replaces, the same position accumulates (ignoring repeats), earlier is
 * discarded.
 *
 * @type {(failure: DescentFailure, idx: number, terminal: TerminalRange) => DescentFailure}
 */
const recordFailure = (failure, idx, terminal) => {
    if (idx > failure.idx) { return { idx, expected: [terminal] } }
    if (idx < failure.idx || failure.expected.includes(terminal)) { return failure }
    return { idx, expected: [...failure.expected, terminal] }
}

/**
 * Creates a recursive descent parser that preserves metadata for each consumed
 * code point.
 *
 * @template T
 * @param {FRule} fr
 * @returns {DescentMatch<T>}
 */
export const descentParser = fr => {
    const data = toData(fr)
    const emptyTags = emptyTagMap(data[0])

    // A suspended sequence match: items[itemIndex] is being matched by the current
    // task; `seq` holds the ASTs of the items already matched.
    /**
     * @typedef {{
     *     readonly kind: 'seq'
     *     readonly tag: AstTag
     *     readonly items: Sequence
     *     readonly itemIndex: number
     *     readonly startIdx: number
     *     readonly seq: AstSequenceMeta<T>
     * }} _SeqFrame
     */

    // A suspended variant match: entries[entryIndex] is being matched by the current
    // task; `emptyResult` is the best zero-consumption success seen so far (or the
    // initial failure), returned if no branch consumes input.
    /**
     * @typedef {{
     *     readonly kind: 'variant'
     *     readonly entries: readonly (readonly [string, string])[]
     *     readonly entryIndex: number
     *     readonly idx: number
     *     readonly emptyResult: DescentMatchResult<T>
     * }} _VariantFrame
     */

    /** @typedef {_SeqFrame | _VariantFrame} _Frame */

    // Immutable cons-cell stack: O(1) push/pop, no array copying per step.
    /**
     * @typedef {null | {
     *     readonly top: _Frame
     *     readonly rest: _Stack
     * }} _Stack
     */

    // The rule invocation about to be evaluated (the recursive version's argument
    // tuple), or null when a result is ready to resume the innermost frame.
    /**
     * @typedef {{
     *     readonly name: string
     *     readonly tag: AstTag
     *     readonly idx: number
     * }} _Task
     */

    // The recursive-descent matcher as an explicit-stack machine: each iteration either
    // starts the current task (pushing a frame for a sequence/variant and descending into
    // its first child) or feeds the pending result into the innermost frame. Semantics are
    // identical to the former recursive `f`, but the JS call stack stays O(1) regardless of
    // grammar recursion depth — right-recursive rules (e.g. repeat0Plus chains) no longer
    // overflow on long input (see the longInput proof group).
    /** @type {DescentMatchRule<T>} */
    const f = (name, tag, cp, idx) => {
        /** @type {(tag: AstTag, sequence: AstSequenceMeta<T>, idx: number) => DescentMatchResult<T>} */
        const mrSuccess = (tag, sequence, idx) => ({ ast: {tag, sequence}, success: true, idx })
        /** @type {(tag: AstTag, sequence: AstSequenceMeta<T>, idx: number) => DescentMatchResult<T>} */
        const mrFail = (tag, sequence, idx) => ({ ast: {tag, sequence}, success: false, idx })

        /** @type {_Stack} */
        let stack = null
        /** @type {_Task | null} */
        let task = { name, tag, idx }
        /** @type {DescentMatchResult<T>} */
        let result = mrFail(undefined, [], idx)
        // High-water mark across the whole match, so it survives the rewinds a
        // failing sequence item does to `result`.
        /** @type {DescentFailure} */
        let furthest = { idx: 0, expected: [] }

        while (true) {
            if (task !== null) {
                // The explicit annotation cuts a control-flow inference cycle (TS7022):
                // `name`'s narrowed type feeds `rule`, whose type would otherwise feed the
                // later `task` assignments that `name`'s narrowing depends on.
                const { name, tag, idx } = /** @type {_Task} */ (task)
                task = null
                /** @type {DataRule} */
                const rule = data[0][name]
                if (typeof rule === 'number') {
                    // No nullable case: `emptyTagOf` in `bnf/data` returns `undefined`
                    // for every terminal, so `emptyTags[name]` here is always
                    // `undefined` and a terminal either consumes one symbol or fails.
                    if (idx < cp.length && rangeContains(...rangeDecode(rule))(cp[idx][0])) {
                        result = mrSuccess(tag, [cp[idx]], idx + 1)
                    } else {
                        // The only place a terminal is rejected, so the only place
                        // the furthest failure can advance.
                        furthest = recordFailure(furthest, idx, rule)
                        result = mrFail(undefined, [], idx)
                    }
                } else if (rule instanceof Array) {
                    if (rule.length === 0) {
                        result = mrSuccess(tag, [], idx)
                    } else {
                        stack = { top: { kind: 'seq', tag, items: rule, itemIndex: 0, startIdx: idx, seq: [] }, rest: stack }
                        task = { name: rule[0], tag: undefined, idx }
                    }
                } else {
                    const entries = definedEntries(rule)
                    const emptyTag = emptyTags[name]
                    const emptyResult = mrFail(emptyTag, [], idx)
                    if (entries.length === 0) {
                        result = emptyResult
                    } else {
                        stack = { top: { kind: 'variant', entries, entryIndex: 0, idx, emptyResult }, rest: stack }
                        const [entryTag, entryName] = entries[0]
                        task = { name: entryName, tag: entryTag, idx }
                    }
                }
                continue
            }

            if (stack === null) {
                // A success has nothing to diagnose; only a failure carries it.
                return result.success ? result : { ...result, failure: furthest }
            }
            const frame = stack.top
            stack = stack.rest

            if (frame.kind === 'seq') {
                const { ast: astRule, success, idx: nidx } = result
                if (success === false) {
                    result = mrFail(frame.tag, [], frame.startIdx)
                } else {
                    const seq = [...frame.seq, astRule]
                    const itemIndex = frame.itemIndex + 1
                    if (itemIndex < frame.items.length) {
                        stack = { top: { ...frame, itemIndex, seq }, rest: stack }
                        task = { name: frame.items[itemIndex], tag: undefined, idx: nidx }
                    } else {
                        result = mrSuccess(frame.tag, seq, nidx)
                    }
                }
            } else {
                // success that consumed input wins immediately: the frame stays popped and
                // `result` propagates to the frame below, matching the recursive `return m`.
                if (!(result.success && frame.idx !== result.idx)) {
                    const emptyResult = result.success ? result : frame.emptyResult
                    const entryIndex = frame.entryIndex + 1
                    if (entryIndex < frame.entries.length) {
                        stack = { top: { ...frame, entryIndex, emptyResult }, rest: stack }
                        const [entryTag, entryName] = frame.entries[entryIndex]
                        task = { name: entryName, tag: entryTag, idx: frame.idx }
                    } else {
                        result = emptyResult
                    }
                }
            }
        }
    }

    /** @type {DescentMatch<T>} */
    const match = (name, cp) => {
        return f(name, undefined, cp, 0)
    }

    return match
}
