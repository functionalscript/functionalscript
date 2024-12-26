import {
    empty,
    vec,
    length,
    concatLsb,
    uintLsb,
    removeLsb,
    concatMsb,
    removeMsb,
    uint,
    lsbFirst,
    msbFirst,
    type Endian,
    type Vec
} from './module.f.ts'

const frontTest = (e: Endian) => (r0: bigint) => (r1: bigint) => () => {
    const vector = vec(8n)(0xF5n) // 0x1F5n
    if (vector !== 0x1F5n) { throw vector }
    const result = e.front(4n)(vector)
    if (result !== r0) { throw result }
    const result2 = e.front(16n)(vector)
    if (result2 !== r1) { throw result2 }
}

const popFront = (e: Endian) => ([r00, r01]: readonly [bigint, bigint]) => ([r10, r11]: readonly [bigint, bigint]) => () => {
    const vector = vec(8n)(0xF5n) // 0x1F5n
    const [result, rest] = e.popFront(4n)(vector)
    if (result !== r00) { throw result }
    if (rest !== r01) { throw rest }
    const [result2, rest2] = e.popFront(16n)(vector)
    if (result2 !== r10) { throw result2 }
    if (rest2 !== r11) { throw rest2 }
}

const removeFront = (e: Endian) => (r0: Vec) => (r1: Vec) => () => {
    const v = vec(16n)(0x3456n) // 0x13456n
    if (v !== 0x13456n) { throw v }
    const r = e.removeFront(4n)(v)
    if (r !== r0) { throw r }
    const r2 = e.removeFront(24n)(v)
    if (r2 !== r1) { throw r2 }
}

const concat = (e: Endian) => (r: Vec) => () => {
    const u8 = vec(8n)
    const a = u8(0x45n) // 0x145n
    if (a !== 0x145n) { throw a }
    const b = u8(0x89n) // 0x189n
    if (b !== 0x189n) { throw b }
    const ab = e.concat(a)(b) // 0x18945n
    if (ab !== r) { throw ab }
}

const assert_eq = (a: bigint, b: bigint) => {
    if (a !== b) { throw [a, b] }
}

export default {
    examples: {
        vec: () => {
            const vec4 = vec(4n)
            const v0 = vec4(5n)     // 0x15n
            if (v0 !== 0x15n) { throw v0 }
            const v1 = vec4(0x5FEn) // 0x1En
            if (v1 !== 0x1En) { throw v1 }
        },
        uint: () => {
            const vector = vec(8n)(0x5n) // 0x105n
            if (vector !== 0x105n) { throw vector }
            const result = uint(vector) // result is 0x5n
            if (result !== 0x5n) { throw result }
        },
        front: () => {
            const vector = vec(8n)(0xF5n) // 0x1F5n

            assert_eq(lsbFirst.front(4n)(vector), 5n)
            assert_eq(lsbFirst.front(16n)(vector), 0xF5n)

            assert_eq(msbFirst.front(4n)(vector), 0xFn)
            assert_eq(msbFirst.front(16n)(vector), 0xF500n)
        }
    },
    front: {
        lsbf: frontTest(lsbFirst)(5n)(0xF5n),
        msbf: frontTest(msbFirst)(0xFn)(0xF500n),
    },
    popFront: {
        lsbm: popFront(lsbFirst)([5n, 0x1Fn])([0xF5n, 1n]),
        msbm: popFront(msbFirst)([0xFn, 0x15n])([0xF500n, 1n]),
    },
    removeFront: {
        lsbm: removeFront(lsbFirst)(0x1345n)(0x1n),
        msbm: removeFront(msbFirst)(0x1456n)(0x1n),
    },
    concat: {
        lsbm: concat(lsbFirst)(0x18945n),
        msbm: concat(msbFirst)(0x14589n),
    },
    uintLsb: () => {
        const vector = 0b1110101n
        const extract3Bits = uintLsb(3n)
        const result = extract3Bits(vector) // result is 0b101n (5n)
        if (result !== 0b101n) { throw result }
    },
    uintSmall: () => {
        const vector = 0b11n
        const extract3Bits = uintLsb(3n)(vector)
        if (extract3Bits !== 0b1n) { throw extract3Bits }
    },
    vecExample: () => {
        const createVector = vec(4n)
        const vector = createVector(5n) // vector is 0b10101n
        if (vector !== 0b10101n) { throw vector }
    },
    length: () => {
        const i = length(empty)
        if (i !== 0n) { throw i }
    },
    bitset: () => {
        const v = vec(8n)(0x5FEn)
        if (v !== 0x1FEn) { throw v }
        if (length(v) !== 8n) { throw 'len' }
        const u = uintLsb(8n)(v)
        if (u !== 0xFEn) { throw v }
    },
    appendBack: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = concatLsb(a)(b)
        if (ab !== 0x18945n) { throw ab }
        const s = length(ab)
        if (s !== 16n) { throw `appendBack: ${s}` }
    },
    removeBack: () => {
        const v = vec(17n)(0x12345n)
        if (v !== 0x32345n) { throw v.toString(16) }
        const r = removeLsb(9n)(v)
        if (r !== 0x191n) { throw r.toString(16) }
    }
}
