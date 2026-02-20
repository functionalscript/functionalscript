import { length, msb, unpack, vec, vec8 } from "../bit_vec/module.f.ts"
import { encode, integer } from "./module.f.ts"

const pop8 = msb.popFront(8n)

export default {
    encodeSmall: () => {
        const v = vec8(0x13n)
        const x = encode(integer, v)
        const lx = length(x)
        if (lx !== 24n) { throw lx }
        const [tag, x1] = pop8(x)
        if (tag !== BigInt(integer)) { throw tag }
        const [len, x2] = pop8(x1)
        if (len !== 1n) { throw len }
        const { length: intLen, uint } = unpack(x2)
        if (intLen !== 8n) { throw intLen }
        if (uint !== 0x13n) { throw uint }
    },
    encodeBig: () => {
        const v = vec(0x7Fn << 3n)(0x1234n)
        const x = encode(integer, v)
        const lx = length(x)
        if (lx !== 129n << 3n) { throw lx }
        /*
        const [tag, x1] = pop8(x)
        if (tag !== BigInt(integer)) { throw tag }
        const [len, x2] = pop8(x1)
        if (len !== 1n) { throw len }
        const { length: intLen, uint } = unpack(x2)
        if (intLen !== 8n) { throw intLen }
        if (uint !== 0x13n) { throw uint }
        */
    }
}
