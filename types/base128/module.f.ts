import { bitLength, mask } from '../bigint/module.f.ts'
import { vec8, type Vec, msb } from '../bit_vec/module.f.ts'

const { concat, popFront } = msb

const pop8 = popFront(8n)

export const encode = (uint: bigint): Vec => {
    const len = bitLength(uint)
    if (len <= 7n) {
        return vec8(uint)
    }
    const shift = (len / 7n) * 7n
    const head = uint >> shift
    const tail = uint & mask(shift)
    // TODO: optimize by using a loop instead of recursion
    return concat(vec8(0x80n | head))(encode(tail))
}

export const decode = (uint: Vec): readonly[bigint, Vec] => {
    const [first, rest] = pop8(uint)
    const result = first & 0x7Fn
    if (first < 0x80n) {
        return [result, rest]
    }
    // TODO: optimize by using a loop instead of recursion
    const [tail, next] = decode(rest)
    return [(result << 7n) | tail, next]
}
