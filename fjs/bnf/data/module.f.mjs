/**
 * The serializable BNF intermediate representation (IR) and the
 * {@link toData} conversion from the functional grammar.
 *
 * This module is the pure, parser-agnostic substrate: it defines the
 * {@link RuleSet} data form (`Rule = Variant | Sequence | TerminalRange |
 * Repeat`) and converts a functional grammar into it. The automaton builders
 * that consume a {@link RuleSet} live in their own sibling modules
 * (`fjs/bnf/ll1`, `fjs/bnf/descent`, …), so the IR stays free of any one
 * parser's machinery.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { DataRule, Rule as FRule, Sequence as FSequence } from '../types.ts'
 * @import { StringSet } from '../../types/string_set/types.ts'
 * @import { EmptyTag, Repeat, Rule, RuleSet, Sequence, Variant, _EmptyTagMap } from './types.ts'
 * @import { _FRuleMap, _NewRule } from './private.ts'
 */

import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import { oneEncode } from '../module.f.mjs'
import { definedEntries, definedValues } from '../../types/object/module.f.mjs'
import { contains, set } from '../../types/string_set/module.f.mjs'

/**
 * Whether a data rule is a {@link Repeat}.
 *
 * Every rule-dispatch site asks this instead of testing for a string inline, so
 * the repetition rule kind has exactly one discriminator to move when the
 * surrounding rule model changes.
 *
 * @param {Rule} rule
 * @returns {rule is Repeat}
 */
export const isRepeat = rule => typeof rule === 'string'

/** @type {(map: _EmptyTagMap) => (rule: Rule) => EmptyTag} */
const emptyTagOf = map => rule => {
    if (typeof rule === 'number') {
        return undefined
    } else if (rule instanceof Array) {
        return rule.every(item => map[item] !== undefined) ? true : undefined
    } else if (isRepeat(rule)) {
        // Zero repetitions is a match whatever the body does, and it carries no
        // tag of its own — a repetition is a sequence of items, not a choice.
        return true
    } else {
        /** @type {EmptyTag} */
        let tag = undefined
        for (const [k, item] of definedEntries(rule)) {
            if (map[item] !== undefined) {
                tag = k
            }
        }
        return tag
    }
}

/** @type {(ruleSet: RuleSet) => (map: _EmptyTagMap) => readonly [_EmptyTagMap, boolean]} */
const emptyTagStep = ruleSet => map => {
    let next = map
    let changed = false
    for (const name in ruleSet) {
        const tag = emptyTagOf(map)(ruleSet[name])
        if (tag !== next[name]) {
            changed = true
        }
        next = { ...next, [name]: tag }
    }
    return [next, changed]
}

/**
 * Computes, for every rule in the set, whether it can match empty input, by
 * the standard nullable-set fixpoint: a sequence is nullable iff all of its
 * items are (AND semantics), a variant iff at least one branch is (its tag is
 * that branch's). Rules may reference each other cyclically (e.g. a `repeat`
 * rule referring to itself), so this starts every rule as non-nullable and
 * relaxes every rule, one round at a time, until a full round changes
 * nothing. A round only ever grows the nullable set or moves a variant's
 * chosen tag to a later (still-nullable) branch, both bounded, so this always
 * terminates — but a rule's tag can still change for rounds *after* its own
 * nullable/non-nullable status has already settled, while a cyclic
 * dependency's tag catches up, so a fixed round count isn't enough.
 *
 * @type {(ruleSet: RuleSet) => _EmptyTagMap}
 */
export const emptyTagMap = ruleSet => {
    const step = emptyTagStep(ruleSet)
    /** @type {(map: _EmptyTagMap) => _EmptyTagMap} */
    const relax = map => {
        const [next, changed] = step(map)
        return changed ? relax(next) : next
    }
    return relax({})
}

//

const { entries } = Object

/** @type {(map: _FRuleMap) => (fr: FRule) => string | undefined} */
const find = map => fr => {
    for (const [k, v] of entries(map)) {
        if (v === fr) {
            return k
        }
    }
    return undefined
}

/** @type {(map: _FRuleMap, name: string) => string} */
const newName = (map, name) => {
    let i = 0
    let result = name
    while (result in map) {
        result = name + i
        ++i
    }
    return result
}

/** @type {(list: FSequence) => _NewRule} */
const sequence = list => map => {
    /** @type {Sequence} */
    let result = []
    /** @type {RuleSet} */
    let set = {}
    for (const fr of list) {
        const [map1, set1, id] = toDataAdd(map)(fr)
        map = map1
        set = { ...set, ...set1 }
        result = [...result, id]
    }
    return [map, set, result]
}

/** @type {(fr: FRule) => _NewRule} */
const variant = fr => map => {
    /** @type {RuleSet} */
    let set = {}
    /** @type {Variant} */
    let rule = {}
    for (const [k, v] of entries(fr)) {
        const [m1, s, id] = toDataAdd(map)(v)
        map = m1
        set = { ...set, ...s }
        rule = { ...rule, [k]: id }
    }
    return [map, set, rule]
}

const mapOneEncode = map(oneEncode)

/** @type {(dr: DataRule) => _NewRule} */
const data = dr => {
    switch (typeof dr) {
        case 'string': {
            return sequence(toArray(mapOneEncode(stringToCodePointList(dr))))
        }
        case 'number':
            return m => [m, {}, dr]
        default:
            if (dr instanceof Array) {
                return sequence(dr)
            }
            return variant(dr)
    }
}

/** @type {(map: _FRuleMap) => (fr: FRule) => readonly [_FRuleMap, RuleSet, string]} */
const toDataAdd = map => fr => {
    {
        const id = find(map)(fr)
        if (id !== undefined) {
            return [map, {}, id]
        }
    }
    /** @type {readonly [DataRule, string]} */
    const [dr, tmpId] =
        typeof fr === 'function' ? [fr(), fr.name] : [fr, '']
    const newRule = data(dr)
    const id = newName(map, tmpId)
    const map1 = { ...map, [id]: fr }
    const [map2, set, rule] = newRule(map1)
    return [map2, { ...set, [id]: rule }, id]
}

//

const { fromEntries } = Object

/** @type {(rule: Rule) => Sequence} */
const refs = rule => {
    if (typeof rule === 'number') {
        return []
    } else if (rule instanceof Array) {
        return rule
    } else if (isRepeat(rule)) {
        return [rule]
    } else {
        return definedValues(rule)
    }
}

/** @type {(ruleSet: RuleSet) => (visited: StringSet, name: string) => StringSet} */
const visit = ruleSet => (visited, name) =>
    contains(name)(visited)
        ? visited
        : refs(ruleSet[name]).reduce(visit(ruleSet), set(name)(visited))

/**
 * Every rule the entry rule can reach, itself included.
 *
 * @type {(ruleSet: RuleSet) => (entry: string) => StringSet}
 */
const reachable = ruleSet => entry => visit(ruleSet)(null, entry)

/** @type {(rule: Rule) => boolean} */
const isNone = rule => rule instanceof Array && rule.length === 0

/**
 * The {@link Repeat} — the name of the item to repeat — that `name` encodes as
 * right-recursion, or `undefined` when it encodes something else.
 *
 * The shape recognized is exactly the unambiguous 0-or-more list: a two-branch
 * variant whose branches are an empty sequence and `[item, name]`, in either
 * order. Everything looser stays as it is — an operator-style tree, a separated
 * list, or a 1-or-more chain all reach `name` again, but their extra items make
 * the grouping a real choice rather than a list, so folding them into a flat
 * sequence would discard structure no rule name is left to recover.
 *
 * Two further conditions keep the fold sound rather than merely plausible:
 * `item` must not lead back to `name`, so `name`'s only self-reference is the
 * tail one, and `item` must not match empty, since a body that can consume
 * nothing has infinitely many parses of the same input.
 *
 * @type {(ruleSet: RuleSet, emptyTags: _EmptyTagMap) => (name: string) => Repeat | undefined}
 */
const repeatOf = (ruleSet, emptyTags) => name => {
    const rule = ruleSet[name]
    if (typeof rule === 'number' || rule instanceof Array || isRepeat(rule)) { return undefined }
    const branches = definedValues(rule)
    if (branches.length !== 2) { return undefined }
    const [a, b] = branches
    const step = isNone(ruleSet[a]) ? b : isNone(ruleSet[b]) ? a : undefined
    if (step === undefined) { return undefined }
    const stepRule = ruleSet[step]
    if (!(stepRule instanceof Array) || stepRule.length !== 2 || stepRule[1] !== name) { return undefined }
    const [item] = stepRule
    if (emptyTags[item] !== undefined || contains(name)(reachable(ruleSet)(item))) { return undefined }
    return item
}

/**
 * Returns the functional item of an unambiguous zero-or-more rule.
 *
 * Recognition runs over the normalized data rules, so lazy aliases in the
 * empty or recursive branch have the same meaning as their direct forms.
 *
 * @type {(rule: FRule) => FRule | null}
 */
export const repeatItem = rule => {
    const [map, ruleSet, entry] = toDataAdd({})(rule)
    const item = repeatOf(ruleSet, emptyTagMap(ruleSet))(entry)
    return item === undefined ? null : /** @type {FRule} */ (map[item])
}

/**
 * Rewrites every right-recursive 0-or-more rule of a {@link RuleSet} into a
 * {@link Repeat}, and drops the rules that the rewrite orphans.
 *
 * The dropped rules are the recursive branch and, unless something else still
 * refers to it, the empty one: both are reachable only through the variant that
 * the {@link Repeat} replaces. Pruning them keeps the invariant that every rule
 * of a generated set is reachable from its entry, so the serialized form holds
 * no dead grammar.
 *
 * @type {(ruleSet: RuleSet, entry: string) => RuleSet}
 */
export const detectRepeat = (ruleSet, entry) => {
    const repeat = repeatOf(ruleSet, emptyTagMap(ruleSet))
    /** @type {RuleSet} */
    const next = fromEntries(entries(ruleSet).map(([k, v]) => [k, repeat(k) ?? v]))
    const live = reachable(next)(entry)
    return fromEntries(entries(next).filter(([k]) => contains(k)(live)))
}

/**
 * Converts a functional grammar rule into serializable BNF data and returns
 * the generated rule set with the entry rule identifier.
 *
 * @type {(fr: FRule) => readonly [RuleSet, string]}
 */
export const toData = fr => {
    const [, ruleSet, id] = toDataAdd({})(fr)
    return [detectRepeat(ruleSet, id), id]
}
