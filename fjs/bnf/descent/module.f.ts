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
 * @module
 */
import { type CodePoint } from '../../text/utf16/module.f.mjs'
import { rangeDecode, type TerminalRange } from '../module.f.ts'
import { contains as rangeContains } from '../../types/range/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.ts'
import { emptyTagMap, toData, type Rule as DataRule, type Sequence } from '../data/module.f.ts'
import { type Rule as FRule } from '../module.f.ts'

export type AstTag = string|true|undefined

/**
 * Recursive descent matcher for a single named rule.
 */
export type DescentMatchRule<T> = (name: string, tag: AstTag, s: readonly CodePointMeta<T>[], idx: number) => DescentMatchResult<T>

/**
 * Where a match ran out of road, for diagnostics.
 *
 * `idx` is the furthest position any terminal was tried at and rejected, and
 * `expected` holds the terminals that would have allowed progress there, in the
 * order the grammar tried them and without repeats.
 *
 * Unlike a failed result's own index, this never rewinds: a failing sequence
 * item rewinds the result to the sequence's start, while the furthest failure is
 * a high-water mark over the whole match — including branches the grammar
 * backtracked out of. That is what makes "expected X or Y at N" possible.
 *
 * `idx` is `0` with an empty `expected` when the match failed without ever
 * rejecting a terminal, as an empty variant does.
 */
export type DescentFailure = {
    readonly idx: number
    readonly expected: readonly TerminalRange[]
}

/**
 * Result of a descent match operation.
 *
 * `failure` is present exactly when `success` is `false`: a successful match has
 * nothing to diagnose, and its `idx` already says where matching stopped. Note
 * the consequence for a match that succeeds *without consuming all input* —
 * `idx` still locates the position it stopped at, but the terminals that would
 * have let it continue are not reported.
 *
 * On failure `idx` has rewound to the start of the enclosing sequence and
 * locates nothing; read `failure.idx` instead.
 *
 * The same type describes a match in progress, where `failure` is likewise
 * absent until the match ends.
 */
export type DescentMatchResult<T> = {
    readonly ast: AstRuleMeta<T>
    readonly success: boolean
    readonly idx: number
    readonly failure?: DescentFailure
}

/**
 * Folds one rejected terminal into the furthest-failure record: further along
 * replaces, the same position accumulates (ignoring repeats), earlier is
 * discarded.
 */
const recordFailure = (failure: DescentFailure, idx: number, terminal: TerminalRange): DescentFailure => {
    if (idx > failure.idx) { return { idx, expected: [terminal] } }
    if (idx < failure.idx || failure.expected.includes(terminal)) { return failure }
    return { idx, expected: [...failure.expected, terminal] }
}

/**
 * Entry-point recursive descent matcher.
 */
export type DescentMatch<T> = (name: string, s: readonly CodePointMeta<T>[]) => DescentMatchResult<T>

/**
 * Code point value paired with metadata.
 */
export type CodePointMeta<T> = readonly[CodePoint, T]

/**
 * AST sequence for the metadata-aware parser.
 */
export type AstSequenceMeta<T> = readonly(AstRuleMeta<T>|CodePointMeta<T>)[]

/**
 * Metadata-aware AST node.
 */
export type AstRuleMeta<T> = {
    readonly tag: AstTag,
    readonly sequence: AstSequenceMeta<T>
}

/**
 * Creates a recursive descent parser that preserves metadata for each consumed
 * code point.
 */
export const descentParser = <T>(fr: FRule): DescentMatch<T> => {
    const data = toData(fr)
    const emptyTags = emptyTagMap(data[0])

    // A suspended sequence match: items[itemIndex] is being matched by the current
    // task; `seq` holds the ASTs of the items already matched.
    type SeqFrame = {
        readonly kind: 'seq'
        readonly tag: AstTag
        readonly items: Sequence
        readonly itemIndex: number
        readonly startIdx: number
        readonly seq: AstSequenceMeta<T>
    }

    // A suspended variant match: entries[entryIndex] is being matched by the current
    // task; `emptyResult` is the best zero-consumption success seen so far (or the
    // initial failure), returned if no branch consumes input.
    type VariantFrame = {
        readonly kind: 'variant'
        readonly entries: readonly (readonly [string, string])[]
        readonly entryIndex: number
        readonly idx: number
        readonly emptyResult: DescentMatchResult<T>
    }

    type Frame = SeqFrame | VariantFrame

    // Immutable cons-cell stack: O(1) push/pop, no array copying per step.
    type Stack = null | {
        readonly top: Frame
        readonly rest: Stack
    }

    // The rule invocation about to be evaluated (the recursive version's argument
    // tuple), or null when a result is ready to resume the innermost frame.
    type Task = {
        readonly name: string
        readonly tag: AstTag
        readonly idx: number
    }

    // The recursive-descent matcher as an explicit-stack machine: each iteration either
    // starts the current task (pushing a frame for a sequence/variant and descending into
    // its first child) or feeds the pending result into the innermost frame. Semantics are
    // identical to the former recursive `f`, but the JS call stack stays O(1) regardless of
    // grammar recursion depth — right-recursive rules (e.g. repeat0Plus chains) no longer
    // overflow on long input (see the longInput proof group).
    const f: DescentMatchRule<T> = (name, tag, cp, idx): DescentMatchResult<T> => {
        const mrSuccess = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => ({ ast: {tag, sequence}, success: true, idx })
        const mrFail = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => ({ ast: {tag, sequence}, success: false, idx })

        let stack: Stack = null
        let task: Task | null = { name, tag, idx }
        let result: DescentMatchResult<T> = mrFail(undefined, [], idx)
        // High-water mark across the whole match, so it survives the rewinds a
        // failing sequence item does to `result`.
        let furthest: DescentFailure = { idx: 0, expected: [] }

        while (true) {
            if (task !== null) {
                const { name, tag, idx }: Task = task
                task = null
                // The explicit annotation cuts a control-flow inference cycle (TS7022):
                // `name`'s narrowed type feeds `rule`, whose type would otherwise feed the
                // later `task` assignments that `name`'s narrowing depends on.
                const rule: DataRule = data[0][name]
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

    const match: DescentMatch<T> = (name, cp): DescentMatchResult<T> => {
        return f(name, undefined, cp, 0)
    }

    return match
}
