import { empty, vec, lenght, concatLsb, uintLsb, uintMsb, removeLsb, concatMsb, removeMsb } from './module.f.mjs'

export default {
    examples: {
        vec: () => {
            const vec4 = vec(4n)
            const v0 = vec4(5n)     // 0x15n
            if (v0 !== 0x15n) { throw v0 }
            const v1 = vec4(0x5FEn) // 0x1En
            if (v1 !== 0x1En) { throw v1 }
        },
        uintLsb: () => {
            const vector = vec(8n)(0xF5n) // 0x1F5n
            if (vector !== 0x1F5n) { throw vector }
            const result = uintLsb(4n)(vector); // result is 5n
            if (result !== 5n) { throw result }
            const result2 = uintLsb(16n)(vector); // result2 is 0xF5n
            if (result2 !== 0xF5n) { throw result2 }
        },
        uintMsb: () => {
            const vector = vec(8n)(0xF5n) // 0x1F5n
            if (vector !== 0x1F5n) { throw vector }
            const result = uintMsb(4n)(vector); // result is 0xFn
            if (result !== 0xFn) { throw result }
            const result2 = uintMsb(16n)(vector); // result2 is 0xF500n
            if (result2 !== 0xF500n) { throw result2 }
        },
        concatLsb: () => {
            const u8 = vec(8n)
            const a = u8(0x45n) // 0x145n
            if (a !== 0x145n) { throw a }
            const b = u8(0x89n) // 0x189n
            if (b !== 0x189n) { throw b }
            const ab = concatLsb(a)(b) // 0x18945n
            if (ab !== 0x18945n) { throw ab }
        },
        concatMsb: () => {
            const u8 = vec(8n)
            const a = u8(0x45n) // 0x145n
            if (a !== 0x145n) { throw a }
            const b = u8(0x89n) // 0x189n
            if (b !== 0x189n) { throw b }
            const ab = concatMsb(a)(b) // 0x14589n
            if (ab !== 0x14589n) { throw ab }
        },
        removeLsb: () => {
            const v = vec(16n)(0x3456n) // 0x13456n
            if (v !== 0x13456n) { throw v }
            const r = removeLsb(4n)(v) // 0x1345n
            if (r !== 0x1345n) { throw r }
            const r2 = removeLsb(24n)(v) // 0x1n
            if (r2 !== 0x1n) { throw r2 }
        },
        removeMsb: () => {
            const v = vec(16n)(0x3456n) // 0x13456n
            if (v !== 0x13456n) { throw v }
            const r = removeMsb(4n)(v) // 0x1456n
            if (r !== 0x1456n) { throw r }
            const r2 = removeMsb(24n)(v) // 0x1n
            if (r2 !== 0x1n) { throw r2 }
        }
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
        const i = lenght(empty)
        if (i !== 0n) { throw i}
    },
    bitset: () => {
        const v = vec(8n)(0x5FEn)
        if (v !== 0x1FEn) { throw v }
        if (lenght(v) !== 8n) { throw 'len' }
        const u = uintLsb(8n)(v)
        if (u !== 0xFEn) { throw v }
    },
    appendBack: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = concatLsb(a)(b)
        if (ab !== 0x18945n) { throw ab }
        const s = lenght(ab)
        if (s !== 16n) { throw `appendBack: ${s}` }
    },
    removeBack: () => {
        const v = vec(17n)(0x12345n)
        if (v !== 0x32345n) { throw v.toString(16) }
        const r = removeLsb(9n)(v)
        if (r !== 0x191n) { throw r.toString(16) }
    }
}
