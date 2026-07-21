/**
 * Recursive descent matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fs/bnf/data`, this is a sibling of the
 * LL(1) dispatch builder (`fs/bnf/ll1`). It walks the grammar by recursive
 * descent and preserves per-code-point metadata, producing a metadata-aware
 * AST ({@link AstRuleMeta}). It also exposes {@link createEmptyTagMap}, which
 * records whether each rule can match the empty input.
 *
 * @module
 */
import { type CodePoint } from '../../text/utf16/module.f.ts'
import { rangeDecode } from '../module.f.ts'
import { contains as rangeContains } from '../../types/range/module.f.ts'
import { definedEntries, type StringMap } from '../../types/object/module.f.ts'
import { type Rule as DataRule, type RuleSet, type Sequence, toData } from '../data/module.f.ts'
import { type Rule as FRule } from '../module.f.ts'

type EmptyTag = string|true|undefined

type EmptyTagEntry = string|boolean

type EmptyTagMap = StringMap<string, EmptyTagEntry>

export type AstTag = string|true|undefined

/**
 * Recursive descent matcher for a single named rule.
 */
export type DescentMatchRule<T> = (name: string, tag: AstTag, s: readonly CodePointMeta<T>[], idx: number) => DescentMatchResult<T>

/**
 * Result tuple of a descent match operation: AST node, success flag, and next index.
 */
export type DescentMatchResult<T> = readonly[AstRuleMeta<T>, boolean, number]

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

const emptyTagMapAdd = (ruleSet: RuleSet) => (map: EmptyTagMap) => (name: string): readonly [RuleSet, EmptyTagMap, EmptyTagEntry] => {
    if (name in map) {
        return [ruleSet, map, map[name]!]
    }

    const rule = ruleSet[name]

    if (typeof rule === 'number') {
        return [ruleSet, { ...map, [name]: false }, false]
    } else if (rule instanceof Array) {
        map = { ...map, [name]: true}
        let emptyTag: EmptyTagEntry = rule.length == 0
        for (const item of rule) {
            const [,newMap,itemEmptyTag] = emptyTagMapAdd(ruleSet)(map)(item)
            map = newMap
            if (emptyTag === false) {
                emptyTag = itemEmptyTag !== false
            }
        }
        return [ruleSet, { ...map, [name]: emptyTag }, emptyTag]
    } else {
        map = { ...map, [name]: true}
        const entries = definedEntries(rule)
        let emptyTag: EmptyTagEntry = false
        for (const [tag, item] of entries) {
            const [,newMap,itemEmptyTag] = emptyTagMapAdd(ruleSet)(map)(item)
            map = newMap
            if (itemEmptyTag !== false) {
                emptyTag = tag
            }
        }
        return [ruleSet, { ...map, [name]: emptyTag }, emptyTag]
    }
}

/**
 * Creates a map that describes whether each rule can consume empty input and,
 * for tagged variants, which tag represents the empty match.
 */
export const createEmptyTagMap = (data: readonly [RuleSet, string]): EmptyTagMap => {
    return emptyTagMapAdd(data[0])({})(data[1])[1]
}

/**
 * Creates a recursive descent parser that preserves metadata for each consumed
 * code point.
 */
export const descentParser = <T>(fr: FRule): DescentMatch<T> => {
    const data = toData(fr)
    const emptyTagMap = createEmptyTagMap(data)

    const getEmptyTag = (name: string): EmptyTag => {
        const res = emptyTagMap[name]
        return res === false ? undefined : res
    }

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
    // overflow on long input. See fs/djs/tokenizer/todo/stack-recursive-tokenization.md.
    const f: DescentMatchRule<T> = (name, tag, cp, idx): DescentMatchResult<T> => {
        const mrSuccess = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, true, idx]
        const mrFail = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, false, idx]

        let stack: Stack = null
        let task: Task | null = { name, tag, idx }
        let result: DescentMatchResult<T> = mrFail(undefined, [], idx)

        while (true) {
            if (task !== null) {
                const { name, tag, idx }: Task = task
                task = null
                // The explicit annotation cuts a control-flow inference cycle (TS7022):
                // `name`'s narrowed type feeds `rule`, whose type would otherwise feed the
                // later `task` assignments that `name`'s narrowing depends on.
                const rule: DataRule = data[0][name]
                if (typeof rule === 'number') {
                    const emptyTag = getEmptyTag(name)
                    if (idx >= cp.length) {
                        result = emptyTag === undefined ? mrFail(emptyTag, [], idx) : mrSuccess(emptyTag, [], idx)
                    } else {
                        const cpi = cp[idx]
                        const range = rangeDecode(rule)
                        result = rangeContains(range)(cpi[0]) ? mrSuccess(tag, [cpi], idx + 1) : mrFail(emptyTag, [], idx)
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
                    const emptyTag = getEmptyTag(name)
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
                return result
            }
            const frame = stack.top
            stack = stack.rest

            if (frame.kind === 'seq') {
                const [astRule, success, nidx] = result
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
                if (!(result[1] && frame.idx !== result[2])) {
                    const emptyResult = result[1] ? result : frame.emptyResult
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
