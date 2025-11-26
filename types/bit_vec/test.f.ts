import { abs, mask } from '../bigint/module.f.ts'
import { asBase, asNominal } from '../nominal/module.f.ts'
import { length, empty, uint, type Vec, vec, lsb, msb, type BitOrder, repeat, vec8 } from './module.f.ts'

const unsafeVec = (a: bigint): Vec => asNominal(a)

// 0x8 = 0b1000 = 0 + 8
// 0x9 = 0b1001 = 1 + 8
// 0xA = 0b1010 = 2 + 8
// 0xB = 0b1011 = 3 + 8
// 0xC = 0b1100 = 4 + 8
// 0xD = 0b1101 = 5 + 8
// 0xE = 0b1110 = 6 + 8
// 0xF = 0b1111 = 7 + 8

const assertEq = <T>(a: T, b: T) => {
    if (a !== b) { throw [a, b] }
}

const assertEq2 = <T>([a0, a1]: readonly[bigint, T], [b0, b1]: readonly[bigint, T]) => {
    assertEq(a0, b0)
    assertEq(a1, b1)
}

const frontTest = (e: BitOrder) => (r0: bigint) => (r1: bigint) => () => {
    const vector = vec(8n)(0xF5n) // 0xF5n
    if (vector !== unsafeVec(0xF5n)) { throw vector }
    const result = e.front(4n)(vector)
    if (result !== r0) { throw result }
    const result2 = e.front(16n)(vector)
    if (result2 !== r1) { throw result2 }
}

const popFront = (e: BitOrder) => ([r00, r01]: readonly [bigint, bigint]) => ([r10, r11]: readonly [bigint, bigint]) => () => {
    const vector = vec(8n)(0xF5n) // 0xF5n
    const [result, rest] = e.popFront(4n)(vector)
    if (result !== r00) { throw result }
    if (rest !== unsafeVec(r01)) { throw rest }
    const [result2, rest2] = e.popFront(16n)(vector)
    if (result2 !== r10) { throw result2 }
    if (rest2 !== unsafeVec(r11)) { throw rest2 }
}

const removeFront = (e: BitOrder) => (r0: Vec) => (r1: Vec) => () => {
    const v = vec(16n)(0x3456n) // -0xB456n
    if (v !== unsafeVec(-0xB456n)) { throw v }
    const r = e.removeFront(4n)(v)
    if (r !== r0) { throw r }
    const r2 = e.removeFront(24n)(v)
    if (r2 !== r1) { throw r2 }
}

const concat = (e: BitOrder) => (r: Vec) => () => {
    const u8 = vec(8n)
    const a = u8(0x45n) // -0xC5n
    if (a !== unsafeVec(-0xC5n)) { throw a }
    const b = u8(0x89n) // 0x89n
    if (b !== unsafeVec(0x89n)) { throw b }
    const ab = e.concat(a)(b) // 0x8945n
    if (ab !== r) { throw ab }
}

export default {
    examples: {
        vec: () => {
            const vec4 = vec(4n)
            const v0 = vec4(5n) // 0b0101 => -0b1101
            if (v0 !== unsafeVec(-0xDn)) { throw v0 }
            const v1 = vec4(0x5FEn) // 0xEn
            if (v1 !== unsafeVec(0xEn)) { throw v1 }
        },
        uint: () => {
            const vector = vec(8n)(0x5n) // -0x85n
            if (vector !== unsafeVec(-0x85n)) { throw vector }
            const result = uint(vector) // result is 0x5n
            if (result !== 0x5n) { throw result }
        },
        front: () => {
            const vector = vec(8n)(0xF5n) // 0xF5n

            assertEq(lsb.front(4n)(vector), 5n)
            assertEq(lsb.front(16n)(vector), 0xF5n)

            assertEq(msb.front(4n)(vector), 0xFn)
            assertEq(msb.front(16n)(vector), 0xF500n)
        },
        removeFront: () => {
            const v = vec(16n)(0x3456n) // -0xB456n

            assertEq(lsb.removeFront(4n)(v), asNominal(-0xB45n))
            assertEq(lsb.removeFront(24n)(v), empty)

            assertEq(msb.removeFront(4n)(v), asNominal(-0xC56n))
            assertEq(msb.removeFront(24n)(v), empty)
        },
        popFront: () => {
            const vector = vec(8n)(0xF5n) // 0xF5n

            assertEq2(lsb.popFront(4n)(vector), [5n, asNominal(0xFn)])
            assertEq2(lsb.popFront(16n)(vector), [0xF5n, empty])

            assertEq2(msb.popFront(4n)(vector), [0xFn, asNominal(-0xDn)])
            assertEq2(msb.popFront(16n)(vector), [0xF500n, empty])
        },
        concat: () => {
            const u8 = vec(8n)
            const a = u8(0x45n) // -0xC5n
            const b = u8(0x89n) // 0x89n

            assertEq(lsb.concat(a)(b), asNominal(0x8945n))
            assertEq(msb.concat(a)(b), asNominal(-0xC589n))
        }
    },
    front: {
        lsbf: frontTest(lsb)(5n)(0xF5n),
        msbf: frontTest(msb)(0xFn)(0xF500n),
    },
    popFront: {
        lsbm: popFront(lsb)([5n, 0xFn])([0xF5n, 0n]),
        msbm: popFront(msb)([0xFn, -0xDn])([0xF500n, 0n]),
    },
    removeFront: {
        lsbm: removeFront(lsb)(asNominal(-0xB45n))(empty),
        msbm: removeFront(msb)(asNominal(-0xC56n))(empty),
    },
    concat: {
        lsbm: concat(lsb)(asNominal(0x8945n)),
        msbm: concat(msb)(asNominal(-0xC589n)),
    },
    uintLsb: () => {
        const vector: Vec = asNominal(0b110101n)
        const extract3Bits = lsb.front(3n)
        const result = extract3Bits(vector) // result is 0b101n (5n)
        if (result !== 0b101n) { throw result }
    },
    uintSmall: () => {
        const vector: Vec = asNominal(0b1n)
        const extract3Bits = lsb.front(3n)(vector)
        if (extract3Bits !== 0b1n) { throw extract3Bits }
    },
    vecExample: () => {
        const createVector = vec(4n)
        const vector = createVector(5n) // vector is -0b1101n
        if (vector !== unsafeVec(-0b1101n)) { throw vector }
    },
    length: () => {
        const len = length(empty)
        if (len !== 0n) { throw len }
    },
    bitset: () => {
        const v = vec(8n)(0x5FEn)
        if (v !== unsafeVec(0xFEn)) { throw v }
        if (length(v) !== 8n) { throw 'len' }
        const u = lsb.front(8n)(v)
        if (u !== 0xFEn) { throw v }
    },
    appendBack: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = lsb.concat(a)(b)
        if (ab !== unsafeVec(0x8945n)) { throw ab }
        const s = length(ab)
        if (s !== 16n) { throw `appendBack: ${s}` }
    },
    removeBack: () => {
        const v = vec(17n)(0x12345n)
        if (v !== unsafeVec(0x12345n)) {
            throw (asBase(v) as bigint).toString(16)
        }
        const r = lsb.removeFront(9n)(v)
        if (r !== unsafeVec(0x91n)) { throw (asBase(r) as bigint).toString(16) }
    },
    uint: [
        // 0
        () => {
            const x = uint(asNominal(0n))
            if (x !== 0n) { throw x }
        },
        // 1
        () => {
            const v: Vec = asNominal(1n)
            const x = uint(v)
            if (x !== 1n) { throw x }
            const len = length(v)
            if (len !== 1n) { throw len }
        },
        // 2
        () => {
            const v: Vec = asNominal(0b10n)
            const x = uint(v)
            if (x !== 0b10n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        },
        // 3
        () => {
            const v: Vec = asNominal(0b11n)
            const x = uint(v)
            if (x !== 0b11n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        },
        // 4
        () => {
            const v: Vec = asNominal(-1n)
            const x = uint(v)
            if (x !== 0n) { throw x }
            const len = length(v)
            if (len !== 1n) { throw len }
        },
        () => {
            const v: Vec = asNominal(-0b10n)
            const x = uint(v)
            if (x !== 0n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        },
        () => {
            const v: Vec = asNominal(-0b11n)
            const x = uint(v)
            if (x !== 1n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        }
    ],
    vec: [
        // 0
        () => {
            const v = asBase(vec(0n)(0n))
            if (v !== 0n) { throw v }
        },
        () => {
            const v = asBase(vec(0n)(1n))
            if (v !== 0n) { throw v }
        },
        () => {
            const v = asBase(vec(0n)(-1n))
            if (v !== 0n) { throw v }
        },
        // 1
        () => {
            const v = asBase(vec(1n)(0n))
            if (v !== -1n) { throw v }
        },
        () => {
            const v = asBase(vec(1n)(1n))
            if (v !== 1n) { throw v }
        },
        () => {
            const v = asBase(vec(1n)(-1n))
            if (v !== 1n) { throw v }
        },
        () => {
            const v = asBase(vec(1n)(0b10n))
            if (v !== -1n) { throw v }
        },
        () => {
            const v = asBase(vec(1n)(0b11n))
            if (v !== 1n) { throw v }
        }
    ],
    both: () => {
        const c = (len: bigint) => (ui: bigint) => (raw: bigint) => {
            const v = vec(len)(ui)
            const x = asBase(v)
            if (x !== raw) { throw x }
            const len2 = length(v)
            if (len2 !== len) { throw len2 }
            const u = uint(v)
            const mui = mask(len) & abs(ui)
            if (u !== mui) { throw u }
        }
        // 0n
        for (const i of [0n, 1n, -1n, 2n, -2n, 3n, -3n]) {
            c(0n)(i)(0n)
        }
        return [
            // 1n
            () => c(1n)(0n)(-1n),
            () => c(1n)(1n)(1n),
            () => c(1n)(-11n)(1n), //< overflow
            // 2n
            () => c(2n)(0n)(-0b10n),
            () => c(2n)(1n)(-0b11n),
            () => c(2n)(0b10n)(0b10n),
            () => c(2n)(0b11n)(0b11n),
            () => c(2n)(-0b111n)(0b11n), //< overflow
        ]
    },
    concat2: () => {
        const c = (a: Vec) => (b: Vec) => (abx: Vec) => {
            const ab = msb.concat(a)(b)
            const abLen = length(ab)
            const abxLen = length(abx)
            if (abLen !== abxLen) { throw abLen }
            const abU = uint(ab)
            const abxU = uint(abx)
            if (abU !== abxU) { throw abU }
        }
        c(vec(4n)(0xFn))(vec(8n)(0xA7n))(vec(12n)(0xFA7n))
        c(vec(4n)(0xFn))(vec(8n)(0x57n))(vec(12n)(0xF57n))
        c(vec(4n)(0x5n))(vec(8n)(0xA7n))(vec(12n)(0x5A7n))
        c(vec(4n)(0x5n))(vec(8n)(0x79n))(vec(12n)(0x579n))
    },
    lsbXor: () => {
        const c = (a: Vec) => (b: Vec) => (e: Vec) => {
            const r = lsb.xor(a)(b)
            if (r !== e) { throw r }
        }
        c(vec(4n)(0x7n))(vec(8n)(0x12n))(vec(8n)(0x7n ^ 0x12n))
    },
    msbXor: () => {
        const c = (a: Vec) => (b: Vec) => (e: Vec) => {
            const r = msb.xor(a)(b)
            if (r !== e) { throw r }
        }
        c(vec(4n)(0x7n))(vec(8n)(0x12n))(vec(8n)(0x70n ^ 0x12n))
    },
    repeat: () => {
        if (repeat(4n)(vec8(0xA5n)) !== vec(32n)(0xA5A5A5A5n)) { throw 'repeat failed' }
        if (repeat(7n)(vec(5n)(0x13n)) !== vec(35n)(0b10011_10011_10011_10011_10011_10011_10011n)) { throw 'repeat failed' }
    }
}
