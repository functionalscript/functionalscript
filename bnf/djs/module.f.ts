/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import { type TerminalRange, type Rule as FRule, toTerminalRangeSequence  } from '../func/module.f.ts'

export type Sequence<Id> = readonly (TerminalRange|Id)[]
export type Rule<Id> = readonly Sequence<Id>[]

export type RuleMap<Id extends string> = { readonly[k in Id]: Rule<Id> }

export const toRuleMap = (src: FRule): RuleMap<string> => {
    const { name } = src
    let queue: readonly (readonly[FRule, string])[] = [[src, name]]
    let result: RuleMap<string> = { [name]: [] }
    let i = 0
    do {
        const [srcOr, name] = queue[i]
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
                        const existingRule = queue.find(([f])=> f === srcItem)
                        if (existingRule !== undefined) {
                            item = existingRule[1]
                        } else {
                            // find a name for the item.
                            const { name } = srcItem
                            item = name
                            {
                                let i = 0
                                while (item in result) {
                                    item = name + i
                                    ++i
                                }
                            }
                            // add the item to a queue under the generate name.
                            queue = [...queue, [srcItem, item]]
                            // add the name to the result and create a rule later.
                            result = { ...result, [item]: [] }
                        }
                    }
                    seq = [...seq, item]
                }
            }
            rule = [...rule, seq]
        }
        // fix the rule in the result.
        result = { ...result, [name]: rule }
        ++i
    } while (i !== queue.length)
    return result
}

