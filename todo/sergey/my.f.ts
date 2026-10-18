import type { StringMap } from "../../fjs/types/object/types.ts"

const entry = (a: any, b: string) => {
    const x = Object.getOwnPropertyDescriptor(a, b)
    return x?.enumerable ? [x.value] : []
}

type Member = (self: unknown) => ((...args: readonly unknown[]) => unknown) | undefined

const members: StringMap<Member> = {
    at: self => (...args) => {}
}

export const dot = (self: any, key: string) => {
    const f = entry(self, key)
    return f.length === 1 ? f[0] : entry(members, key)[0]?.(self)
}
