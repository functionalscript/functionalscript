import { length, type Vec } from '../../types/bit_vec/module.f.ts'
import { empty, msb, vec, vec8 } from '../../types/bit_vec/module.f.ts'
import { flip } from '../../types/function/module.f.ts'
import { repeat } from '../../types/monoid/module.f.ts'
import { computeSync, type Sha2 } from '../sha2/module.f.ts'

const { concat } = msb

const oPad = vec8(0x5cn)

const iPad = vec8(0x36n)

const padRepeat = repeat({ identity: empty, operation: concat })

export const hmac = (sha2: Sha2) => {
    const { blockLength } = sha2
    const p = flip(padRepeat)(blockLength >> 3n)
    const ip = p(iPad)
    const op = p(oPad)
    const c = computeSync(sha2)
    const vbl = vec(blockLength)
    const xor = (a: bigint) => (b: bigint) => vbl(a ^ b)
    return (k: bigint) => (m: bigint) => {
        const k1 = length(k) > blockLength ? c([k]) : k
        const k2 = concat(k1)(vec(blockLength - length(k1))(0n))
        const xk2 = xor(k2)
        const f = (p: Vec, msg: Vec) => c([xk2(p), msg])
        const m1 = f(ip, m)
        return f(op, m1)
    }
}
