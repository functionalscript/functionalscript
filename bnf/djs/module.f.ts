/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import { empty as emptyArray } from '../../types/array/module.f.ts'
import { strictEqual } from '../../types/function/operator/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { rangeMap, RangeMapOp, type RangeMapArray } from '../../types/range_map/module.f.ts'
import { type TerminalRange, type Rule as FRule, toTerminalRangeSequence } from '../func/module.f.ts'

export type Sequence<Id> = readonly (TerminalRange | Id)[]
export type Rule<Id> = readonly Sequence<Id>[]

export type RuleMap<Id extends string> = { readonly [k in Id]: Rule<Id> }

/**
 * Find a unique name for the rule.
 */
const findName = (map: RuleMap<string>, rule: FRule): string => {
    const { name } = rule
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

/**
 * Temporary rule map.
 */
type RuleMapTmp = {
    readonly queue: readonly (readonly [FRule, string])[]
    readonly result: RuleMap<string>
}

/**
 * Add a new rule to the temporary map.
 *
 * @param param0
 * @returns
 */
const tmpAdd = ({ queue, result }: RuleMapTmp) => (src: FRule): [RuleMapTmp, string] => {
    // find a name for the item.
    const name = findName(result, src)
    return [{
        // add the item to a queue under the name.
        queue: [...queue, [src, name]],
        // add the name to the result and fill the rule later.
        result: { ...result, [name]: emptyArray },
    }, name]
}

const tmpNew = tmpAdd({
    queue: emptyArray,
    result: {},
})

const tmpItem = (tmp: RuleMapTmp, src: FRule): [RuleMapTmp, string] => {
    const found = tmp.queue.find(([f]) => f === src)
    return  found !== undefined ? [tmp, found[1]] : tmpAdd(tmp)(src)
}

/**
 * Transforming functional rule to a serializable rule map.
 *
 * @param src a functional rule.
 * @returns a serializable rule map.
 */
export const toRuleMap = (src: FRule): RuleMap<string> => {
    let [tmp] = tmpNew(src)
    let i = 0
    do {
        const [srcOr, name] = tmp.queue[i]
        let rule: Rule<string> = emptyArray
        // iterate all sequences of the `Or` rule.
        for (const srcSeq of srcOr()) {
            let seq: Sequence<string>
            if (typeof srcSeq === 'string') {
                seq = toTerminalRangeSequence(srcSeq)
            } else {
                seq = emptyArray
                // iterate all items of the sequence.
                for (const srcItem of srcSeq) {
                    let item: TerminalRange | string
                    if (srcItem instanceof Array) {
                        item = srcItem
                    } else {
                        [tmp, item] = tmpItem(tmp, srcItem)
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

type DispatchResult = Sequence<string>|undefined

type Dispatch = RangeMapArray<DispatchResult>

const dispatchOp = rangeMap<DispatchResult>({
    union: a => b => {
        if (a === undefined) {
            return b
        }
        if (b === undefined) {
            return a
        }
        throw ['can not merge', a, b]
    },
    equal: strictEqual,
    def: undefined,
})

type DispatchRule = readonly[boolean, Dispatch]

type DispatchMap = { readonly[k in string]: DispatchRule }

export const dispatchMap = (map: RuleMap<string>): DispatchMap => {
    const dispatchSequence = (dm: DispatchMap, sequence: Sequence<string>): [DispatchMap, DispatchRule] => {
        if (sequence.length === 0) {
            return [dm, [true, []]]
        }
        let result: Dispatch = []
        for (const item of sequence) {

        }
        return [dm, [false, result]]
    }
    const dispatchRule = (dm: DispatchMap, name: string): DispatchMap => {
        let result = dm
        if (name in result) { return result }
        let empty = false
        let dispatch: Dispatch = []
        for (const sequence of map[name]) {
            const [newResult, [e, d]] = dispatchSequence(result, sequence)
            result = newResult
            empty ||= e
            dispatch = toArray(dispatchOp.merge(dispatch)(d))
        }
        return { ...result, [name]: [empty, dispatch] }
    }
    let result: DispatchMap = {}
    for (const k in map) {
        result = dispatchRule(result, k)
    }
    return result
}
