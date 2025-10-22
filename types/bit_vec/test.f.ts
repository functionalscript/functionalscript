import { as_base, as_nominal } from '../nominal/module.f.ts'
import {
    empty,
    vec,
    length,
    uint,
    lsb,
    msb,
    type BitOrder,
    type Vec
} from './module.f.ts'

const frontTest = (e: BitOrder) => (r0: bigint) => (r1: bigint) => () => {
    const vector = vec(8n)(0xF5n) // 0x1F5n
    if (vector !== as_nominal(0x1F5n)) { throw vector }
    const result = e.front(4n)(vector)
    if (result !== r0) { throw result }
    const result2 = e.front(16n)(vector)
    if (result2 !== r1) { throw result2 }
}

const popFront = (e: BitOrder) => ([r00, r01]: readonly [bigint, bigint]) => ([r10, r11]: readonly [bigint, bigint]) => () => {
    const vector = vec(8n)(0xF5n) // 0x1F5n
    const [result, rest] = e.popFront(4n)(vector)
    if (result !== r00) { throw result }
    if (rest !== as_nominal(r01)) { throw rest }
    const [result2, rest2] = e.popFront(16n)(vector)
    if (result2 !== r10) { throw result2 }
    if (rest2 !== as_nominal(r11)) { throw rest2 }
}

const removeFront = (e: BitOrder) => (r0: Vec) => (r1: Vec) => () => {
    const v = vec(16n)(0x3456n) // 0x13456n
    if (v !== as_nominal(0x13456n)) { throw v }
    const r = e.removeFront(4n)(v)
    if (r !== r0) { throw r }
    const r2 = e.removeFront(24n)(v)
    if (r2 !== r1) { throw r2 }
}

const concat = (e: BitOrder) => (r: Vec) => () => {
    const u8 = vec(8n)
    const a = u8(0x45n) // 0x145n
    if (a !== as_nominal(0x145n)) { throw a }
    const b = u8(0x89n) // 0x189n
    if (b !== as_nominal(0x189n)) { throw b }
    const ab = e.concat(a)(b) // 0x18945n
    if (ab !== r) { throw ab }
}

const assertEq = <T>(a: T, b: T) => {
    if (a !== b) { throw [a, b] }
}

const assertEq2 = <T>([a0, a1]: readonly[bigint, T], [b0, b1]: readonly[bigint, T]) => {
    assertEq(a0, b0)
    assertEq(a1, b1)
}

export default {
    examples: {
        vec: () => {
            const vec4 = vec(4n)
            const v0 = vec4(5n)     // 0x15n
            if (v0 !== as_nominal(0x15n)) { throw v0 }
            const v1 = vec4(0x5FEn) // 0x1En
            if (v1 !== as_nominal(0x1En)) { throw v1 }
        },
        uint: () => {
            const vector = vec(8n)(0x5n) // 0x105n
            if (vector !== as_nominal(0x105n)) { throw vector }
            const result = uint(vector) // result is 0x5n
            if (result !== 0x5n) { throw result }
        },
        front: () => {
            const vector = vec(8n)(0xF5n) // 0x1F5n

            assertEq(lsb.front(4n)(vector), 5n)
            assertEq(lsb.front(16n)(vector), 0xF5n)

            assertEq(msb.front(4n)(vector), 0xFn)
            assertEq(msb.front(16n)(vector), 0xF500n)
        },
        removeFront: () => {
            const v = vec(16n)(0x3456n) // 0x13456n

            assertEq(lsb.removeFront(4n)(v), as_nominal(0x1345n))
            assertEq(lsb.removeFront(24n)(v), as_nominal(0x1n))

            assertEq(msb.removeFront(4n)(v), as_nominal(0x1456n))
            assertEq(msb.removeFront(24n)(v), as_nominal(0x1n))
        },
        popFront: () => {
            const vector = vec(8n)(0xF5n) // 0x1F5n

            assertEq2(lsb.popFront(4n)(vector), [5n, as_nominal(0x1Fn)])
            assertEq2(lsb.popFront(16n)(vector), [0xF5n, as_nominal(1n)])

            assertEq2(msb.popFront(4n)(vector), [0xFn, as_nominal(0x15n)])
            assertEq2(msb.popFront(16n)(vector), [0xF500n, as_nominal(1n)])
        },
        concat: () => {
            const u8 = vec(8n)
            const a = u8(0x45n) // 0x145n
            const b = u8(0x89n) // 0x189n

            assertEq(lsb.concat(a)(b), as_nominal(0x18945n))
            assertEq(msb.concat(a)(b), as_nominal(0x14589n))
        }
    },
    front: {
        lsbf: frontTest(lsb)(5n)(0xF5n),
        msbf: frontTest(msb)(0xFn)(0xF500n),
    },
    popFront: {
        lsbm: popFront(lsb)([5n, 0x1Fn])([0xF5n, 1n]),
        msbm: popFront(msb)([0xFn, 0x15n])([0xF500n, 1n]),
    },
    removeFront: {
        lsbm: removeFront(lsb)(as_nominal(0x1345n))(as_nominal(0x1n)),
        msbm: removeFront(msb)(as_nominal(0x1456n))(as_nominal(0x1n)),
    },
    concat: {
        lsbm: concat(lsb)(as_nominal(0x18945n)),
        msbm: concat(msb)(as_nominal(0x14589n)),
    },
    uintLsb: () => {
        const vector: Vec = as_nominal(0b1110101n)
        const extract3Bits = lsb.front(3n)
        const result = extract3Bits(vector) // result is 0b101n (5n)
        if (result !== 0b101n) { throw result }
    },
    uintSmall: () => {
        const vector: Vec = as_nominal(0b11n)
        const extract3Bits = lsb.front(3n)(vector)
        if (extract3Bits !== 0b1n) { throw extract3Bits }
    },
    vecExample: () => {
        const createVector = vec(4n)
        const vector = createVector(5n) // vector is 0b10101n
        if (vector !== as_nominal(0b10101n)) { throw vector }
    },
    length: () => {
        const i = length(empty)
        if (i !== 0n) { throw i }
    },
    bitset: () => {
        const v = vec(8n)(0x5FEn)
        if (v !== as_nominal(0x1FEn)) { throw v }
        if (length(v) !== 8n) { throw 'len' }
        const u = lsb.front(8n)(v)
        if (u !== 0xFEn) { throw v }
    },
    appendBack: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = lsb.concat(a)(b)
        if (ab !== as_nominal(0x18945n)) { throw ab }
        const s = length(ab)
        if (s !== 16n) { throw `appendBack: ${s}` }
    },
    removeBack: () => {
        const v = vec(17n)(0x12345n)
        if (v !== as_nominal(0x32345n)) {
            throw (as_base(v) as bigint).toString(16)
        }
        const r = lsb.removeFront(9n)(v)
        if (r !== as_nominal(0x191n)) { throw (as_base(r) as bigint).toString(16) }
    }
}
