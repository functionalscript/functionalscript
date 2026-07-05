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
import { type RuleSet, toData } from '../data/module.f.ts'
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

    const f: DescentMatchRule<T> = (name, tag, cp, idx): DescentMatchResult<T> => {
        const mrSuccess = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, true, idx]
        const mrFail = (tag: AstTag, sequence: AstSequenceMeta<T>, idx: number): DescentMatchResult<T> => [{tag, sequence}, false, idx]

        const rule = data[0][name]
        if (typeof rule === 'number') {
            const emptyTag = getEmptyTag(name)
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
            const emptyTag = getEmptyTag(name)
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
