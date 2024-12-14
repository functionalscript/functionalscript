import { empty, length, append, vec, uint } from './module.f.mjs'

export default {
    length: () => {
        const i = length(empty)
        if (i !== 0n) { throw i}
    },
    bitset: () => {
        const v = vec(8n)(0x5FEn)
        if (v !== 0x1FEn) { throw v }
        const u = uint(8n)(v)
        if (u !== 0xFEn) { throw v }
    },
    append: () => {
        const vec8 = vec(8n)
        const a = vec8(0x345n)
        const b = vec8(0x789n)
        const ab = append(a)(b)
        if (ab === 0x18945n) { throw ab }
    }
}
