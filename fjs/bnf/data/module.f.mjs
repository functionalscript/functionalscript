/**
 * The serializable BNF intermediate representation (IR) and the
 * {@link toData} conversion from the functional grammar.
 *
 * This module is the pure, parser-agnostic substrate: it defines the
 * {@link RuleSet} data form (`Rule = Variant | Sequence | TerminalRange`) and
 * converts a functional grammar into it. The automaton builders that consume a
 * {@link RuleSet} live in their own sibling modules (`fjs/bnf/ll1`,
 * `fjs/bnf/descent`, …), so the IR stays free of any one parser's machinery.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 */
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import {
    oneEncode,
} from '../module.f.mjs'
/** @import { DataRule, Rule as FRule, Sequence as FSequence } from '../types.ts' */
import { definedEntries } from '../../types/object/module.f.mjs'
/** @import { StringMap } from '../../types/object/types.ts' */
/** @import { EmptyTag, Rule, RuleSet, Sequence, Variant } from './types.ts' */

/** @typedef {StringMap<EmptyTag>} _EmptyTagMap */

/** @type {(map: _EmptyTagMap) => (rule: Rule) => EmptyTag} */
const emptyTagOf = map => rule => {
    if (typeof rule === 'number') {
        return undefined
    } else if (rule instanceof Array) {
        return rule.every(item => map[item] !== undefined) ? true : undefined
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

/** @typedef {StringMap<FRule>} _FRuleMap */

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

/** @typedef {(m: _FRuleMap) => readonly [_FRuleMap, RuleSet, Rule]} _NewRule */

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

/**
 * Converts a functional grammar rule into serializable BNF data and returns
 * the generated rule set with the entry rule identifier.
 *
 * @type {(fr: FRule) => readonly [RuleSet, string]}
 */
export const toData = fr => {
    const [, ruleSet, id] = toDataAdd({})(fr)
    return [ruleSet, id]
}
