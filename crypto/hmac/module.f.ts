import { length } from '../../types/bit_vec/module.f.ts'
import { empty, msb, vec, vec8 } from '../../types/bit_vec/module.f.ts'
import { repeat } from '../../types/monoid/module.f.ts'
import type { Sha2 } from '../sha2/module.f.ts'

const { concat } = msb

const oPad = vec8(0x5cn)

const iPad = vec8(0x36n)

const padRepeat = repeat({ identity: empty, operation: concat })

export const hmac = ({ blockLength, init, append, end }: Sha2) => {
    const n = blockLength >> 3n
    const ip = padRepeat(iPad)(n)
    const op = padRepeat(oPad)(n)
    const appendInit = append(init)
    const vbl = vec(blockLength)
    const xor = (a: bigint) => (b: bigint) => vbl(a ^ b)
    return (k: bigint) => (m: bigint) => {
        const k1 = length(k) > blockLength ? end(appendInit(k)) : k
        const k2 = concat(k1)(vec(blockLength - length(k1))(0n))
        const xk2 = xor(k2)
        const f = (p: bigint) => (msg: bigint) => end(append(appendInit(xk2(p)))(msg))
        const m1 = f(ip)(m)
        return f(op)(m1)
    }
}
