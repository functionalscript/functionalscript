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
    encode7F: () => {
        const valueLen = 0x7Fn << 3n
        const value = 0x1234n
        const v = vec(valueLen)(value)
        const x = encode(integer, v)
        const lx = length(x)
        if (lx !== 0x81n << 3n) { throw lx }
        const [tag, x1] = pop8(x)
        if (tag !== BigInt(integer)) { throw tag }
        const [len, x2] = pop8(x1)
        if (len !== 0x7Fn) { throw len }
        const { length: intLen, uint } = unpack(x2)
        if (intLen !== valueLen) { throw intLen }
        if (uint !== value) { throw uint }
    },
    encode80: () => {
        const valueLen = 0x80n << 3n
        const value = 0x123456n
        const v = vec(valueLen)(value)
        const x = encode(integer, v)
        const lx = length(x)
        if (lx !== 0x83n << 3n) { throw lx }
        const [tag, x1] = pop8(x)
        if (tag !== BigInt(integer)) { throw tag }
        const [lenLen, x2] = pop8(x1)
        if (lenLen !== 0x81n) { throw lenLen }
        const [len, x3] = pop8(x2)
        if (len !== 0x80n) { throw len }
        const { length: intLen, uint } = unpack(x3)
        if (intLen !== valueLen) { throw intLen }
        if (uint !== value) { throw uint }
    },
}
