import { msb, type Vec, length, vec, empty } from "../bit_vec/module.f.ts"
import type { Nullable } from "../nullable/module.f.ts"

const m = '0123456789abcdefghjkmnpqrstvwxyz'

const { popFront, concat } = msb

export const toCBase32 = (v: Vec): string => {
    let result = ''
    while (true) {
        const len = length(v)
        if (len === 0n) { break }
        const [r, rest] = popFront(5n)(v)
        result += m[Number(r)]
        v = rest
    }
    return result
}

const vec5 = vec(5n)

const normalizeChar = (c: string): string => {
    const lower = c.toLowerCase()
    switch (lower) {
        case 'i': { return '1' }
        case 'l': { return '1' }
        case 'o': { return '0' }
        default: { return lower }
    }
}

const toCrockfordIndex = (c: string): number => m.indexOf(normalizeChar(c))

export const fromCBase32 = (s: string): Nullable<Vec> => {
    let result: Vec = empty
    for (const c of s) {
        const index = toCrockfordIndex(c)
        if (index < 0) { return null }
        const v = vec5(BigInt(index))
        result = concat(result)(v)
    }
    return result
}
