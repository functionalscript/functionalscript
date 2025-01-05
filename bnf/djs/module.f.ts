/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import { length } from "../../types/list/module.f.ts";
import { type TerminalRange, type Rule as FRule, toTerminalRangeSequence  } from '../func/module.f.ts'

export type Sequence<Id> = readonly (TerminalRange|Id)[]
export type Rule<Id> = readonly Sequence<Id>[]

export type RuleMap<Id extends string> = { readonly[k in Id]: Rule<Id> }

export const toRuleMap = (fr: FRule): RuleMap<string> => {
    const { name } = fr
    let map: readonly (readonly[FRule, string])[] = [[fr, name]]
    let result: RuleMap<string> = { [name]: [] }
    let i = 0
    do {
        const [fr, name] = map[i]
        /**
        if (map.find(([f])=> f === fr) !== undefined) {
            continue
        }
        // not found
        const { name } = fr
        let newName = name
        {
            let i = 0
            while (newName in result) {
                newName = name + i
                ++i
            }
        }
        */
        let rule: Rule<string> = []
        for (const fs of fr()) {
            let seq: Sequence<string>
            if (typeof fs === 'string') {
                seq = toTerminalRangeSequence(fs)
            } else {
                seq = []
                for (const fr of fs) {
                    let item: TerminalRange|string
                    if (fr instanceof Array) {
                        item = fr
                    } else {
                        const x = map.find(([f])=> f === fr)
                        if (x !== undefined) {
                            item = x[1]
                        } else {
                            const { name } = fr
                            item = name
                            {
                                let i = 0
                                while (item in result) {
                                    item = name + i
                                    ++i
                                }
                            }
                            map = [...map, [fr, item]]
                            result = { ...result, [item]: [] }
                        }
                    }
                    seq = [...seq, item]
                }
            }
            rule = [...rule, seq]
        }
        //
        result = { ...result, [name]: rule }
        ++i
    } while (i !== map.length)
    return result
}

