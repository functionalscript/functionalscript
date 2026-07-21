/**
 * Recursive descent matcher backend over the BNF data {@link RuleSet}.
 *
 * Built from the serializable IR in `fs/bnf/data`, this is a sibling of the
 * LL(1) dispatch builder (`fs/bnf/ll1`). It walks the grammar by recursive
 * descent and preserves per-code-point metadata, producing a metadata-aware
 * AST ({@link AstRuleMeta}). Nullability (which rule can match empty input) is
 * computed once by {@link emptyTagMap} in `fs/bnf/data`.
 *
 * @module
 */
import { type CodePoint } from '../../text/utf16/module.f.ts'
import { rangeDecode } from '../module.f.ts'
import { contains as rangeContains } from '../../types/range/module.f.ts'
import { definedEntries } from '../../types/object/module.f.ts'
import { emptyTagMap, toData } from '../data/module.f.ts'
import { type Rule as FRule } from '../module.f.ts'

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

/**
 * Creates a recursive descent parser that preserves metadata for each consumed
 * code point.
 */
export const descentParser = <T>(fr: FRule): DescentMatch<T> => {
    const data = toData(fr)
    const emptyTags = emptyTagMap(data[0])

    const f: DescentMatchRule<T> = (name, tag, cp, idx): DescentMatchResult<T> => {
        const mrSuccess = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, true, idx]
        const mrFail = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, false, idx]

        const rule = data[0][name]
        if (typeof rule === 'number') {
            const emptyTag = emptyTags[name]
            if (idx >= cp.length) {
                return emptyTag === undefined ? mrFail(emptyTag, [], idx) : mrSuccess(emptyTag, [], idx)
            }

            const cpi = cp[idx]
            const range = rangeDecode(rule)
            if (rangeContains(range)(cpi[0])) {
                return mrSuccess(tag, [cpi], idx + 1)
            }
            return mrFail(emptyTag, [], idx)
        } else if (rule instanceof Array) {
            let seq: AstSequenceMeta<T> = []
            let tidx = idx
            for (const item of rule) {
                const m = f(item, undefined, cp, tidx)
                const [astRule, success, nidx] = m
                tidx = nidx
                if (success === false) {
                    return mrFail(tag, [], idx)
                }
                seq = [...seq, astRule]
            }
            return mrSuccess(tag, seq, tidx)
        } else {
            const entries = definedEntries(rule)
            const emptyTag = emptyTags[name]
            let emptyResult = mrFail(emptyTag, [], idx)
            for (const [tag, item] of entries) {
                const m = f(item, tag, cp, idx)
                if (m[1]) {
                    if (idx !== m[2])
                        return m

                    emptyResult = m
                }
            }
            return emptyResult
        }
    }

    const match: DescentMatch<T> = (name, cp): DescentMatchResult<T> => {
        return f(name, undefined, cp, 0)
    }

    return match
}
