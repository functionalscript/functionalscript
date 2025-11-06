import { abs, mask } from '../bigint/module.f.ts'
import { asBase, asNominal } from '../nominal/module.f.ts'
import { length, empty, uint, type Vec, vec, msbConcat, lsbXor, msbXor, lsb, msb } from './module.f.ts'

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
    },
    length: () => {
        const len = length(empty)
        if (len !== 0n) { throw len }
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
    concat: () => {
        const c = (a: Vec) => (b: Vec) => (abx: Vec) => {
            const ab = msbConcat(a)(b)
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
            const r = lsbXor(a)(b)
            if (r !== e) { throw r }
        }
        c(vec(4n)(0x7n))(vec(8n)(0x12n))(vec(8n)(0x7n ^ 0x12n))
    },
    msbXor: () => {
        const c = (a: Vec) => (b: Vec) => (e: Vec) => {
            const r = msbXor(a)(b)
            if (r !== e) { throw r }
        }
        c(vec(4n)(0x7n))(vec(8n)(0x12n))(vec(8n)(0x70n ^ 0x12n))
    }
}
