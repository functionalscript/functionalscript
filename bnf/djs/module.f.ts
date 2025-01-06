/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import { type TerminalRange, type Rule as FRule, toTerminalRangeSequence  } from '../func/module.f.ts'

export type Sequence<Id> = readonly (TerminalRange|Id)[]
export type Rule<Id> = readonly Sequence<Id>[]

export type RuleMap<Id extends string> = { readonly[k in Id]: Rule<Id> }

const findName = (map: RuleMap<string>, srcRule: FRule): string => {
    // find a name for the item.
    const { name } = srcRule
    let result = name
    {
        let i = 0
        while (result in map) {
            result = name + i
            ++i
        }
    }
    return result
}

type RuleMapTmp = {
    readonly queue: readonly (readonly[FRule, string])[]
    readonly result: RuleMap<string>
}

export const toRuleMap = (src: FRule): RuleMap<string> => {
    const { name } = src
    let tmp: RuleMapTmp = {
        queue: [[src, name]],
        result: { [name]: [] }
    }
    let i = 0
    do {
        const [srcOr, name] = tmp.queue[i]
        let rule: Rule<string> = []
        // iterate all sequences of the `Or` rule.
        for (const srcSeq of srcOr()) {
            let seq: Sequence<string>
            if (typeof srcSeq === 'string') {
                seq = toTerminalRangeSequence(srcSeq)
            } else {
                seq = []
                // iterate all items of the sequence.
                for (const srcItem of srcSeq) {
                    let item: TerminalRange|string
                    if (srcItem instanceof Array) {
                        item = srcItem
                    } else {
                        const existingRule = tmp.queue.find(([f])=> f === srcItem)
                        if (existingRule !== undefined) {
                            item = existingRule[1]
                        } else {
                            // find a name for the item.
                            item = findName(tmp.result, srcItem)
                            tmp = {
                                // add the item to a queue under the generate name.
                                queue: [...tmp.queue, [srcItem, item]],
                                // add the name to the result and create a rule later.
                                result: { ...tmp.result, [item]: [] },
                            }
                        }
                    }
                    seq = [...seq, item]
                }
            }
            rule = [...rule, seq]
        }
        // fix the rule in the result.
        tmp = {
            queue: tmp.queue,
            result: { ...tmp.result, [name]: rule },
        }
        ++i
    } while (i !== tmp.queue.length)
    return tmp.result
}

