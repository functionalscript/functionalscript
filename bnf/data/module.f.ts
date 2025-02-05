import { type Rule as FRule } from '../module.f.ts'

export type InputRange = number

export type Sequence = readonly Rule[]

export type Or = {
    readonly[k in string]: Rule
}

export type Rule = Or | Sequence | InputRange | string

export type RuleSet = Readonly<Record<string, Rule>>

type FRuleMap = { readonly[k in string]: FRule }

const find = (map: FRuleMap) => (fr: FRule): string | undefined => {
    for (const [k, v] of Object.entries(map)) {
        if (v === fr) {
            return k
        }
    }
    return undefined
}

export const toData = (map: FRuleMap, result: RuleSet) => (fr: FRule): RuleSet => {
    if (find(map)(fr) === undefined) {
        return result
    }
    return result
}
