/**
 * Recursive descent matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fjs/bnf/data`, this is a sibling of the
 * LL(1) dispatch builder (`fjs/bnf/ll1`). It walks the grammar by recursive
 * descent and preserves per-code-point metadata, producing a metadata-aware
 * AST ({@link AstRuleMeta}). Nullability (which rule can match empty input) is
 * computed once by {@link emptyTagMap} in `fjs/bnf/data`.
 *
 * The caller passes physical symbols only; the matcher synthesizes the one
 * logical EOF ({@link eofSymbol}) after them, so a grammar can require the end
 * of input with the `eof` terminal.
 *
 * A failed result also carries a {@link DescentFailure}: the furthest position a
 * terminal was rejected at, which — unlike the result's own index — never
 * rewinds and is what diagnostics should be built from.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { TerminalRange } from '../types.ts'
 * @import { Rule as DataRule, Sequence } from '../data/types.ts'
 * @import { Rule as FRule } from '../types.ts'
 * @import { AstRuleMeta, AstTag, AstSequenceMeta, CodePointMeta, DescentFailure, DescentMatch, DescentMatchResult, DescentMatchRule } from './types.ts'
 */

import { eofSymbol, rangeDecode } from '../module.f.mjs'
import { contains as rangeContains } from '../../types/range/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { emptyTagMap, toData } from '../data/module.f.mjs'

/**
 * A match position that includes EOF consumption: `0 .. cp.length` are the
 * physical positions, and `cp.length + 1` is where the one synthesized EOF has
 * been consumed.
 *
 * This is the complete cursor the design calls `(idx, eofConsumed)`, written as
 * one number: `eofConsumed` can only be true at the physical end, so the pair
 * and the extended position hold the same information, and comparing cursors
 * compares progress — consuming EOF *is* progress even though the public index
 * does not move.
 *
 * @typedef {number} _Cursor
 */

/**
 * The furthest-failure record while matching, positioned by the complete
 * cursor. {@link DescentFailure} is its public, physically-positioned form.
 *
 * @typedef {{
 *     readonly pos: _Cursor
 *     readonly expected: readonly TerminalRange[]
 * }} _Failure
 */

/**
 * The machine's own result: a {@link DescentMatchResult} positioned by the
 * complete cursor, and with no failure record — that one is tracked per match
 * rather than per frame.
 *
 * @template T
 * @typedef {{
 *     readonly ast: AstRuleMeta<T>
 *     readonly success: boolean
 *     readonly pos: _Cursor
 * }} _Result
 */

/**
 * The public, physical index of a cursor. Consuming EOF moves the cursor past
 * the physical end, and both cursors report `input.length`.
 *
 * @type {(length: number) => (pos: _Cursor) => number}
 */
const physicalIdx = length => pos => Math.min(pos, length)

/**
 * The semantic symbol a cursor points at: a code point inside the physical
 * input, and the synthesized {@link eofSymbol} at its end. Only meaningful
 * where the cursor still has a symbol, `pos <= cp.length`.
 *
 * @type {<T>(cp: readonly CodePointMeta<T>[], pos: _Cursor) => number}
 */
const symbolAt = (cp, pos) => pos < cp.length ? cp[pos][0] : eofSymbol

/**
 * What consuming the symbol at a cursor contributes to the AST: the code point
 * with its metadata, and nothing for the synthesized EOF — it has no physical
 * source element.
 *
 * @type {<T>(cp: readonly CodePointMeta<T>[], pos: _Cursor) => AstSequenceMeta<T>}
 */
const leafAt = (cp, pos) => pos < cp.length ? [cp[pos]] : []

/**
 * Folds one rejected terminal into the furthest-failure record: further along
 * replaces, the same cursor accumulates (ignoring repeats), earlier is
 * discarded. The comparison is on the complete cursor, so a failure after EOF
 * was consumed is further than one at the same physical index before it.
 *
 * @type {(failure: _Failure, pos: _Cursor, terminal: TerminalRange) => _Failure}
 */
const recordFailure = (failure, pos, terminal) => {
    if (pos > failure.pos) { return { pos, expected: [terminal] } }
    if (pos < failure.pos || failure.expected.includes(terminal)) { return failure }
    return { pos, expected: [...failure.expected, terminal] }
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

    /** @type {(tag: AstTag, sequence: AstSequenceMeta<T>, pos: _Cursor) => _Result<T>} */
    const mrSuccess = (tag, sequence, pos) => ({ ast: {tag, sequence}, success: true, pos })
    /** @type {(tag: AstTag, sequence: AstSequenceMeta<T>, pos: _Cursor) => _Result<T>} */
    const mrFail = (tag, sequence, pos) => ({ ast: {tag, sequence}, success: false, pos })

    // A suspended sequence match: items[itemIndex] is being matched by the current
    // task; `seq` holds the ASTs of the items already matched.
    /**
     * @typedef {{
     *     readonly kind: 'seq'
     *     readonly tag: AstTag
     *     readonly items: Sequence
     *     readonly itemIndex: number
     *     readonly startPos: _Cursor
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
     *     readonly pos: _Cursor
     *     readonly emptyResult: _Result<T>
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
     *     readonly pos: _Cursor
     * }} _Task
     */

    // The recursive-descent matcher as an explicit-stack machine: each iteration either
    // starts the current task (pushing a frame for a sequence/variant and descending into
    // its first child) or feeds the pending result into the innermost frame. Semantics are
    // identical to the former recursive `f`, but the JS call stack stays O(1) regardless of
    // grammar recursion depth — right-recursive rules (e.g. repeat0Plus chains) no longer
    // overflow on long input (see the longInput proof group).
    /** @type {DescentMatchRule<T>} */
    const f = (name, tag, cp, startPos) => {
        const physical = physicalIdx(cp.length)

        /** @type {_Stack} */
        let stack = null
        /** @type {_Task | null} */
        let task = { name, tag, pos: startPos }
        /** @type {_Result<T>} */
        let result = mrFail(undefined, [], startPos)
        // High-water mark across the whole match, so it survives the rewinds a
        // failing sequence item does to `result`.
        /** @type {_Failure} */
        let furthest = { pos: 0, expected: [] }

        while (true) {
            if (task !== null) {
                // The explicit annotation cuts a control-flow inference cycle (TS7022):
                // `name`'s narrowed type feeds `rule`, whose type would otherwise feed the
                // later `task` assignments that `name`'s narrowing depends on.
                const { name, tag, pos } = /** @type {_Task} */ (task)
                task = null
                /** @type {DataRule} */
                const rule = data[0][name]
                if (typeof rule === 'number') {
                    // No nullable case: `emptyTagOf` in `bnf/data` returns `undefined`
                    // for every terminal, so `emptyTags[name]` here is always
                    // `undefined` and a terminal either consumes one symbol or fails.
                    // Past the synthesized EOF there is no symbol left to consume.
                    if (pos <= cp.length && rangeContains(...rangeDecode(rule))(symbolAt(cp, pos))) {
                        result = mrSuccess(tag, leafAt(cp, pos), pos + 1)
                    } else {
                        // The only place a terminal is rejected, so the only place
                        // the furthest failure can advance.
                        furthest = recordFailure(furthest, pos, rule)
                        result = mrFail(undefined, [], pos)
                    }
                } else if (rule instanceof Array) {
                    if (rule.length === 0) {
                        result = mrSuccess(tag, [], pos)
                    } else {
                        stack = { top: { kind: 'seq', tag, items: rule, itemIndex: 0, startPos: pos, seq: [] }, rest: stack }
                        task = { name: rule[0], tag: undefined, pos }
                    }
                } else {
                    const entries = definedEntries(rule)
                    const emptyTag = emptyTags[name]
                    const emptyResult = mrFail(emptyTag, [], pos)
                    if (entries.length === 0) {
                        result = emptyResult
                    } else {
                        stack = { top: { kind: 'variant', entries, entryIndex: 0, pos, emptyResult }, rest: stack }
                        const [entryTag, entryName] = entries[0]
                        task = { name: entryName, tag: entryTag, pos }
                    }
                }
                continue
            }

            if (stack === null) {
                const { ast, success, pos } = result
                /** @type {DescentMatchResult<T>} */
                const mr = { ast, success, idx: physical(pos) }
                // A success has nothing to diagnose; only a failure carries it.
                return success
                    ? mr
                    : { ...mr, failure: { idx: physical(furthest.pos), expected: furthest.expected } }
            }
            const frame = stack.top
            stack = stack.rest

            if (frame.kind === 'seq') {
                const { ast: astRule, success, pos } = result
                if (success === false) {
                    result = mrFail(frame.tag, [], frame.startPos)
                } else {
                    const seq = [...frame.seq, astRule]
                    const itemIndex = frame.itemIndex + 1
                    if (itemIndex < frame.items.length) {
                        stack = { top: { ...frame, itemIndex, seq }, rest: stack }
                        task = { name: frame.items[itemIndex], tag: undefined, pos }
                    } else {
                        result = mrSuccess(frame.tag, seq, pos)
                    }
                }
            } else {
                // success that consumed input wins immediately: the frame stays popped and
                // `result` propagates to the frame below, matching the recursive `return m`.
                // Consuming EOF counts as consumption, because the cursor moved.
                if (!(result.success && frame.pos !== result.pos)) {
                    const emptyResult = result.success ? result : frame.emptyResult
                    const entryIndex = frame.entryIndex + 1
                    if (entryIndex < frame.entries.length) {
                        stack = { top: { ...frame, entryIndex, emptyResult }, rest: stack }
                        const [entryTag, entryName] = frame.entries[entryIndex]
                        task = { name: entryName, tag: entryTag, pos: frame.pos }
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
