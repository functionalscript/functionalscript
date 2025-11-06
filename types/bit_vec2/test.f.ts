import { mask } from '../bigint/module.f.ts'
import { asBase, asNominal } from '../nominal/module.f.ts'
import { length, empty, uint, type Vec, vec, msbConcat } from './module.f.ts'

export default {
    length: () => {
        const len = length(empty)
        if (len !== 0n ) { throw len }
    },
    uint: () => {
        {
            const x = uint(asNominal(0n))
            if (x !== 0n) { throw x }
        }
        {
            const v: Vec = asNominal(1n)
            const x = uint(v)
            if (x !== 1n) { throw x }
            const len = length(v)
            if (len !== 1n) { throw len }
        }
        {
            const v: Vec = asNominal(0b10n)
            const x = uint(v)
            if (x !== 0b10n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        }
        {
            const v: Vec = asNominal(0b11n)
            const x = uint(v)
            if (x !== 0b11n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        }
        {
            const v: Vec = asNominal(-1n)
            const x = uint(v)
            if (x !== 0n) { throw x }
            const len = length(v)
            if (len !== 1n) { throw len }
        }
        {
            const v: Vec = asNominal(-0b10n)
            const x = uint(v)
            if (x !== 1n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        }
        {
            const v: Vec = asNominal(-0b11n)
            const x = uint(v)
            if (x !== 0n) { throw x }
            const len = length(v)
            if (len !== 2n) { throw len }
        }
    },
    vec: () => {
        // 0
        {
            const v = asBase(vec(0n)(0n))
            if (v !== 0n) { throw v }
        }
        {
            const v = asBase(vec(0n)(1n))
            if (v !== 0n) { throw v }
        }
        {
            const v = asBase(vec(0n)(-1n))
            if (v !== 0n) { throw v }
        }
        // 1
        {
            const v = asBase(vec(1n)(0n))
            if (v !== -1n) { throw v }
        }
        {
            const v = asBase(vec(1n)(1n))
            if (v !== 1n) { throw v }
        }
        {
            const v = asBase(vec(1n)(-1n))
            if (v !== 1n) { throw v }
        }
        {
            const v = asBase(vec(1n)(0b10n))
            if (v !== -1n) { throw v }
        }
        {
            const v = asBase(vec(1n)(0b11n))
            if (v !== 1n) { throw v }
        }
    },
    both: () => {
        const c = (len: bigint) => (ui: bigint) => (raw: bigint) => {
            const v = vec(len)(ui)
            const x = asBase(v)
            if (x !== raw) { throw x }
            const len2 = length(v)
            if (len2 !== len) { throw len2 }
            const u = uint(v)
            const mui = mask(len) & ui
            if (u !== mui) { throw u }
        }
        // 0n
        for (const i of [0n, 1n, -1n, 2n, -2n, 3n, -3n]) {
            c(0n)(i)(0n)
        }
        // 1n
        c(1n)(0n)(-1n)
        c(1n)(1n)(1n)
        c(1n)(-1n)(1n) //< overflow
        // 2n
        c(2n)(0n)(-0b11n)
        c(2n)(1n)(-0b10n)
        c(2n)(0b10n)(0b10n)
        c(2n)(0b11n)(0b11n)
        c(2n)(0b111n)(0b11n) //< overflow
        // 3n
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
        //c(vec(4n)(0x5n))(vec(8n)(0xA7n))(vec(12n)(0x5A7n))
        //c(vec(4n)(0x5n))(vec(8n)(0x79n))(vec(12n)(0x579n))
    }
}
