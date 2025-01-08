/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import type { CodePoint } from '../../text/utf16/module.f.ts'
import { empty as emptyArray } from '../../types/array/module.f.ts'
import { strictEqual } from '../../types/function/operator/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
import { rangeMap, type RangeMapArray } from '../../types/range_map/module.f.ts'
import type { TerminalRange, Rule as FRule } from '../func/module.f.ts'

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
    return found !== undefined ? [tmp, found[1]] : tmpAdd(tmp)(src)
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
            let s: Sequence<string> = emptyArray
            // iterate all items of the sequence.
            for (const srcItem of srcSeq) {
                let item: TerminalRange | string
                if (srcItem instanceof Array) {
                    item = srcItem
                } else {
                    [tmp, item] = tmpItem(tmp, srcItem)
                }
                s = [...s, item]
            }
            rule = [...rule, s]
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

type DispatchResult = Sequence<string> | null

type Dispatch = RangeMapArray<DispatchResult>

const dispatchOp = rangeMap<DispatchResult>({
    union: a => b => {
        if (a === null) {
            return b
        }
        if (b === null) {
            return a
        }
        throw ['can not merge [', a, '][', b, ']']
    },
    equal: strictEqual,
    def: null,
})

type DispatchRule = readonly [boolean, Dispatch]

type DispatchMap = { readonly [k in string]: DispatchRule }

export const dispatchMap = (ruleMap: RuleMap<string>): DispatchMap => {
    const dispatchSequence = (dm: DispatchMap, sequence: Sequence<string>): [DispatchMap, DispatchRule] => {
        let empty = true
        let result: Dispatch = []
        for (const item of sequence) {
            if (typeof item === 'string') {
                dm = dispatchRule(dm, item)
                const [e, dispatch] = dm[item]
                result = toArray(dispatchOp.merge
                    (result)
                    (dispatch.map(x => [x[0] === null ? null : sequence, x[1]])))
                if (e) {
                    continue
                }
            } else {
                const dispatch = dispatchOp.fromRange(item)(sequence)
                result = toArray(dispatchOp.merge(result)(dispatch))
            }
            empty = false
            break
        }
        return [dm, [empty, result]]
    }
    const dispatchRule = (dm: DispatchMap, name: string): DispatchMap => {
        if (name in dm) { return dm }
        let empty = false
        let dispatch: Dispatch = []
        for (const sequence of ruleMap[name]) {
            const [newDm, [e, d]] = dispatchSequence(dm, sequence)
            dm = newDm
            empty ||= e
            dispatch = toArray(dispatchOp.merge(dispatch)(d))
        }
        return { ...dm, [name]: [empty, dispatch] }
    }
    let result: DispatchMap = {}
    for (const k in ruleMap) {
        result = dispatchRule(result, k)
    }
    // TODO: validate all sequences if they are deterministic
    return result
}

export type AstSequence = readonly(AstRule|CodePoint)[]

export type AstRule = readonly[string, AstSequence]

export type Remainder = readonly CodePoint[] | null

export type MatchResult = readonly[AstRule, Remainder]

export type Match = (name: string, s: readonly CodePoint[]) => MatchResult

/**
 * Creates an LL1 parser for the given map.
 *
 * @param map a prepared dispatch map.
 * @returns a parser.
 */
export const parser = (map: DispatchMap): Match => {
    const f: Match = (name, s): MatchResult => {
        const mr = (a: AstSequence, r: Remainder): MatchResult => [[name, a], r]
        const mre = (a: AstSequence) => mr(a, null)
        const [empty, sequence] = map[name]
        if (s.length === 0) {
            return mr([], empty ? s : null)
        }
        const cp = s[0]
        const i = dispatchOp.get(cp)(sequence)
        if (i === null) {
            return mr([], empty ? s : null)
        }
        let a: AstSequence = []
        let si = s
        for (const c of i) {
            if (typeof c === 'string') {
                const [astRule, newSi] = f(c, si)
                a = [...a, astRule]
                if (newSi === null) {
                    return mre(a)
                }
                si = newSi
            } else {
                // c is TerminalRange
                const [first, ...newSi] = si
                if (first === undefined || !contains(c)(first)) {
                    return mre(a)
                }
                a = [...a, first]
                si = newSi
            }
        }
        return mr(a, si)
    }
    return f
}
