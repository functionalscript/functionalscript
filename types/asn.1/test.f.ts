import { empty, length, listToVec, msb, unpack, vec, vec8, type Vec } from "../bit_vec/module.f.ts"
import { asBase } from "../nominal/module.f.ts"
import {
    decodeRaw,
    decodeInteger,
    encodeRaw,
    encodeInteger,
    integer,
    type SupportedRecord,
    encode,
    decode,
    constructedSequence,
    octetString,
    boolean,
    constructedSet
} from "./module.f.ts"

const { concat, popFront: pop } = msb
const cat = listToVec(msb)
const pop8 = pop(8n)

const check = (tag: bigint, v: Vec, rest: Vec) => {
        const s = encodeRaw([tag, v])
        const [[t0, v0], r] = decodeRaw(concat(s)(rest))
        if (t0 !== tag) { throw `t0: ${t0}` }
        if (v0 !== v) { throw `v0: ${asBase(v0)}` }
        if (r !== rest) { throw `r: ${asBase(r)}` }
}

const integerValueCheck = (i: bigint, v: Vec) => {
    const v0 = encodeInteger(i)
    if (v !== v0) { throw `encode: ${asBase(v)}, ${asBase(v0)}` }
    const i0 = decodeInteger(v)
    if (i !== i0) { throw [i, i0] }
}

const ch0 = (r: SupportedRecord, v: Vec, rest: Vec) => {
    const [r0, rest0] = decode(concat(v)(rest))
    if (rest0 !== rest) { throw `rest: ${asBase(rest0)}` }
    const v0 = encode(r)
    const v1 = encode(r0)
    if (v !== v0) { throw `encode: ${asBase(v)}, ${asBase(v0)}` }
    if (v !== v1) { throw `encode: ${asBase(v)}, ${asBase(v1)}` }
}

const ch = (r: SupportedRecord, v: Vec) => {
    ch0(r, v, empty)
    ch0(r, v, vec8(0x23n))
    ch0(r, v, vec(16n)(0x2345n))
}

export default {
    encodeSmall: () => {
        const v = vec8(0x13n)
        const x = encodeRaw([integer, v])
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
        const x = encodeRaw([integer, v])
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
        const x = encodeRaw([integer, v])
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
    encodeFF: () => {
        const valueLen = 0xFFn << 3n
        const value = 0x123456n
        const v = vec(valueLen)(value)
        const x = encodeRaw([integer, v])
        const lx = length(x)
        if (lx !== valueLen + (3n << 3n)) { throw `lx: ${lx}` }
        const [tag, x1] = pop8(x)
        if (tag !== BigInt(integer)) { throw tag }
        const [lenLen, x2] = pop8(x1)
        if (lenLen !== 0x81n) { throw lenLen }
        const [len, x3] = pop8(x2)
        if (len !== 0xFFn) { throw len }
        const { length: intLen, uint } = unpack(x3)
        if (intLen !== valueLen) { throw intLen }
        if (uint !== value) { throw uint }
    },
    encode103: () => {
        const valueLen = 0x103n << 3n
        const value = 0x123456n
        const v = vec(valueLen)(value)
        const x = encodeRaw([integer, v])
        const lx = length(x)
        if (lx !== valueLen + (4n << 3n)) { throw `lx: ${lx}` }
        const [tag, x1] = pop8(x)
        if (tag !== BigInt(integer)) { throw tag }
        const [lenLen, x2] = pop8(x1)
        if (lenLen !== 0x82n) { throw lenLen }
        const [len, x3] = pop(16n)(x2)
        if (len !== 0x103n) { throw len }
        const { length: intLen, uint } = unpack(x3)
        if (intLen !== valueLen) { throw intLen }
        if (uint !== value) { throw uint }
    },
    ed: [
        () => {
            const tag = integer
            const v = vec(0x10n)(0x8234n)
            if (asBase(v) !== 0x8234n) { throw asBase(v).toString(16) }
            check(integer, v, empty)
        },
        {
            x80: () => check(integer, vec(0x80n)(0x8234n), empty),
            x100: () => check(integer, vec(0x100n)(0x8234n), vec8(0x23n)),
            x1000: () => check(integer, vec(0x1000n)(0x8234n), vec8(0x23n)),
            x10000: () => check(integer, vec(0x1_0000n)(0x8234n), vec8(0x23n)),
            x20000: () => check(integer, vec(0x2_0000n)(0x8234n), vec8(0x23n)),
            x40000: () => check(integer, vec(0x4_0000n)(0x8234n), empty),
            x80000: () => check(integer, vec(0x8_0000n)(0x8234n), empty),
            xC0000: () => check(integer, vec(0xC_0000n)(0x8234n), empty),
            xE0000: () => check(integer, vec(0xE_0000n)(0x8234n), empty),
            xF0000: () => check(integer, vec(0xF_0000n)(0x8234n), empty),
            xFFF00: () => check(integer, vec(0xF_FF00n)(0x8234n), empty),
            xFFF80: () => check(integer, vec(0xF_FF80n)(0x8234n), empty),
            xFFFC0: () => check(integer, vec(0xF_FFC0n)(0x8234n), empty),
            xFFFD0: () => check(integer, vec(0xF_FFD0n)(0x8234n), empty),
            //// fail on Bun
            //xFFFD8: () => check(integer, vec(0xF_FFD8n)(0x8234n), empty),
            //xFFFE0: () => check(integer, vec(0xF_FFE0n)(0x8234n), empty),
            //e100000: () => check(integer, vec(0x10_0000n)(0x8234n), empty),
            //x100000: () => check(integer, vec(0x10_0000n)(0x8234n), vec8(0x23n)),
            //x1000000: () => check(integer, vec(0x100_0000n)(0x8234n), vec8(0x23n)),
            //x10000000: () => check(integer, vec(0x1000_0000n)(0x8234n), vec8(0x23n)),
            //x20000000: () => check(integer, vec(0x2000_0000n)(0x8234n), vec8(0x23n)),
            //x30000000: () => check(integer, vec(0x3000_0000n)(0x8234n), vec8(0x23n)),
            //x38000000: () => check(integer, vec(0x3800_0000n)(0x8234n), vec8(0x23n)),
            //x3C000000: () => check(integer, vec(0x3800_0000n)(0x8234n), vec8(0x23n)),
            //x3E000000: () => check(integer, vec(0x3E00_0000n)(0x8234n), vec8(0x23n)),
            //x3F000000: () => check(integer, vec(0x3F00_0000n)(0x8234n), vec8(0x23n)),
            //x3F800000: () => check(integer, vec(0x3F80_0000n)(0x8234n), vec8(0x23n)),
            //x3FFFFFC0: () => check(integer, vec(0x3FFF_FFC0n)(0x8234n), vec8(0x23n)),
            //e3FFFFFC8: () => check(integer, vec(0x3FFF_FFC8n)(0x8234n), empty),
            //// fail on Node
            //x3FFFFFC8: () => check(integer, vec(0x3FFF_FFC1n)(0x8234n), vec8(0x23n)),
            //x40000000: () => check(integer, vec(0x4000_0000n)(0x8234n), vec8(0x23n)),
            // check(integer, vec(0x1_0000_0000n)(0x8234n), vec8(0x23n))
        },
    ],
    integerValue: {
        zero: () => integerValueCheck(0n, vec8(0n)),
        one: () => integerValueCheck(1n, vec8(1n)),
        minusOne: () => integerValueCheck(-1n, vec8(0xFFn)),
        x7F: () => integerValueCheck(0x7Fn, vec8(0x7Fn)),
        x80: () => integerValueCheck(0x80n, vec(16n)(0x80n)),
        xFF: () => integerValueCheck(0xFFn, vec(16n)(0xFFn)),
        nx7F: () => integerValueCheck(-0x7Fn, vec8(0x81n)),
        nx80: () => integerValueCheck(-0x80n, vec8(0x80n)),
        nx81: () => integerValueCheck(-0x81n, vec(16n)(0xFF7Fn)),
        nx7FFF: () => integerValueCheck(-0x7FFFn, vec(16n)(0x8001n)),
        nx8000: () => integerValueCheck(-0x8000n, vec(16n)(0x8000n)),
        nx8001: () => integerValueCheck(-0x8001n, vec(24n)(0xFF7FFFn)),
    },
    encodeDecode: {
        integer: () => {
            ch([integer, 0n], cat([vec8(BigInt(integer)), vec8(1n), vec8(0n)]))
            ch([integer, 1n], cat([vec8(BigInt(integer)), vec8(1n), vec8(1n)]))
        },
        sequence: () => {
            ch([constructedSequence, []], cat([vec8(BigInt(constructedSequence)), vec8(0n)]))
            ch(
                [constructedSequence, [[integer, 0n]]],
                cat([vec8(BigInt(constructedSequence)), vec8(3n), encode([integer, 0n])])
            )
            ch(
                [constructedSequence, [[integer, 1n], [integer, 2n]]],
                cat([vec8(BigInt(constructedSequence)), vec8(6n), encode([integer, 1n]), encode([integer, 2n])])
            )
            ch(
                [constructedSequence, [[octetString, vec8(0x23n)], [boolean, true], [boolean, false]]],
                cat([
                    vec8(BigInt(constructedSequence)),
                    vec8(9n),
                    encode([octetString, vec8(0x23n)]),
                    encode([boolean, true]),
                    encode([boolean, false]),
                ])
            )
        },
        set: () => {
            ch([constructedSet, [[integer, 2n], [integer, 1n]]],
                cat([vec8(BigInt(constructedSet)), vec8(6n), encode([integer, 1n]), encode([integer, 2n])]))
        }
    }
}
