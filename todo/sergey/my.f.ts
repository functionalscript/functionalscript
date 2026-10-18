import type { StringMap } from "../../fjs/types/object/types.ts"

const entry = (a: any, b: string) => {
    const x = Object.getOwnPropertyDescriptor(a, b)
    return x?.enumerable ? [x.value] : []
}

type Member = (self: unknown) => ((...args: readonly unknown[]) => unknown) | undefined

const members: StringMap<Member> = {
    at: self => (...args) => {}
}

export const dot = (self: any, index: string) => {
    const f = entry(self, index)
    return f.length === 1 ? f[0] : entry(members, index)[0]?.(self)
}

type PropertyLambda = {
    readonly end: () => unknown
    // `|?()`
    readonly call: (...args: readonly unknown[]) => unknown
    // `|?.()`
    readonly optionCall: (...args: readonly unknown[]) => unknown
}

type OptionLambda = {
    readonly end: () => unknown
    // `|()`
    readonly call: (...args: readonly unknown[]) => OptionLambda
    // `|.`
    readonly dot: (index: string) => OptionPropertyLambda
}

type OptionPropertyLambda = {
    readonly end: () => unknown
    // `?.()`
    readonly optionCall: (...args: readonly unknown[]) => unknown
    // `|!()`
    readonly endCall: (...args: readonly[]) => unknown
}

type Dot = (self: any, index: string) => PropertyLambda
