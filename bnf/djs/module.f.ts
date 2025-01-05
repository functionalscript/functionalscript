// import type { Rule as FRule } from '../func/module.f.ts'

/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import type { TerminalRange } from '../func/module.f.ts'

export type Sequence<Id> = readonly (TerminalRange|Id)[]
export type Rule<Id> = readonly Sequence<Id>[]

export type RuleMap<Id extends string> = { readonly[k in Id]: Rule<Id> }

/*
export const toRuleMap = (rule: FRule): RuleMap<string> => {
    let map: Map<LazyRule|string, string> = new Map()
    let result: RuleMap<string> = {}
    if (typeof rule === 'function') {
        if (map.has(rule)) {
            return result
        }
        const name = rule.name
        rule = rule()
    }
    return result
}
*/
