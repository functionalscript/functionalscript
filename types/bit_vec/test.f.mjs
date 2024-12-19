import { empty, vec, lenght } from './module.f.mjs'
import { appendBack, uint, removeFront } from './le/module.f.mjs'

export default {
    uintExample: () => {
        const vector = 0b1110101n;
        const extract3Bits = uint(3n);
        const result = extract3Bits(vector); // result is 0b101n (5n)
        if (result !== 0b101n) { throw result }
    },
    vecExample: () => {
        const createVector = vec(4n);
        const vector = createVector(5n); // vector is 0b10101n
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
        const u = uint(8n)(v)
        if (u !== 0xFEn) { throw v }
    },
    appendBack: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = appendBack(a)(b)
        if (ab !== 0x18945n) { throw ab }
        const s = lenght(ab)
        if (s !== 16n) { throw `appendBack: ${s}` }
    },
    removeBack: () => {
        const v = vec(17n)(0x12345n)
        if (v !== 0x32345n) { throw v.toString(16) }
        const r = removeFront(9n)(v)
        if (r !== 0x191n) { throw r.toString(16) }
    }
}
