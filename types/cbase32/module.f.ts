import { msb, type Vec, length, vec, empty } from "../bit_vec/module.f.ts"

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

export const fromCBase32 = (s: string): Vec => {
    let result: Vec = empty
    for (const c of s) {
        const v = vec5(BigInt(m.indexOf(c)))
        result = concat(result)(v)
    }
    return result
}
