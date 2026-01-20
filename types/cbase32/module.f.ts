import { msb, lsb, type Vec, length, vec, empty } from "../bit_vec/module.f.ts"
import type { Nullable } from "../nullable/module.f.ts"

//                         0123456789abcdef
const m = '0123456789abcdefghjkmnpqrstvwxyz'

const { popFront, concat } = msb

const popBack1 = lsb.popFront(1n)

const popFront5 = popFront(5n)

export const vec5xToCBase32 = (v: Vec): string => {
    let result = ''
    while (true) {
        const len = length(v)
        if (len === 0n) { break }
        const [r, rest] = popFront5(v)
        result += m[Number(r)]
        v = rest
    }
    return result
}

export const vecToCBase32 = (v: Vec): string => {
    const len = length(v)
    const extraLen = 5n - len % 5n
    const last = 1n << (extraLen - 1n)
    const padded = concat(v)(vec(extraLen)(last))
    return vec5xToCBase32(padded)
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

export const cBase32ToVec5x = (s: string): Nullable<Vec> => {
    let result: Vec = empty
    for (const c of s) {
        const index = toCrockfordIndex(c)
        if (index < 0) { return null }
        const v = vec5(BigInt(index))
        result = concat(result)(v)
    }
    return result
}

export const cBase32ToVec = (s: string): Nullable<Vec> => {
    let v = cBase32ToVec5x(s)
    if (v === null || v === empty) { return null }
    // TODO: replace with a function that computes trailing zeros.
    while (true) {
        const [last, v0] = popBack1(v)
        v = v0
        if (last === 1n) { return v }
    }
}
