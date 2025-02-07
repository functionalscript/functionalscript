import type { Rule as FRule } from '../module.f.ts'

export type InputRange = number

export type Sequence = readonly string[]

export type Variant = {
    readonly[k in string]: string
}

export type Rule = Variant | Sequence | InputRange

export type RuleSet = Readonly<Record<string, Rule>>

type FRuleMap = { readonly[k in string]: FRule }

const { entries } = Object

const find = (map: FRuleMap) => (fr: FRule): string | undefined => {
    for (const [k, v] of entries(map)) {
        if (v === fr) {
            return k
        }
    }
    return undefined
}

const newName = (map: FRuleMap, name: string) => {
    let i = 0
    let result = name
    while (!(result in map)) {
        result = name + i
        ++i
    }
    return result
}

type RuleSetMap = readonly[FRuleMap, RuleSet]

export const toData = ([map, result]: RuleSetMap) => (fr: FRule): readonly[RuleSetMap, string] =>  {
    let name = find(map)(fr)
    if (name !== undefined) {
        return [[map, result], name]
    }
    if (typeof fr === 'function') {
        name = fr.name
        fr = fr()
    }
    switch (typeof fr) {
        case 'string':
            name = fr
            break
        case 'number':
            name = fr.toString()
            break
        default:
            if (fr instanceof Array) {
                // sequence
            } else {
                // or
            }
    }
    return [[map, result], '']
}
