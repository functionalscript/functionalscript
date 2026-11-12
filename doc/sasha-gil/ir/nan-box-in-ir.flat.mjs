// @ts-nocheck
// The NaN box of doc/sergey-shandar/nanvm/README.md in one piece, as
// doc/sasha-gil/ir/type-system.md writes it: 23 patterns and the numbers.
// It accompanies section 1 of nan-box-in-ir.md.
import { array, bits, bool, code, f64c, i, named, object, ref, stat, tail, u, u16, u64 } from './nan-box-in-ir.edsl.mjs'

// The objects on the heap. A type that is declared later is a thunk.
const StrObj = object('StrObj', { units: tail(u16, u(31)) })
const BigObj = object('BigObj', { negative: bool, words: tail(u64, u(31)) })
const ArrObj = object('ArrObj', { items: tail(() => any, u(31)) })
const ObjObj = object('ObjObj', { entries: tail({ key: () => any.string, value: () => any }, u(31)) })
const FnObj = object('FnObj', {
    code: code([() => any, () => any], () => any),
    frame: () => any,
    length: u(31),
    text: () => any.string,
})

// Repeated layouts are host functions.
const nibble = n => n.toString(2).padStart(4, '0')
/** A short string in a row with an 8-bit tag: `n` units of `w` bits, and the tag holds `n`. */
const row = (w, n) => [`0111_1111_1111_0…0_u…u_${nibble(n)}_1000`, { u: array(u(w), n) }]
/** The two references of a kind: `heap` is counted, and `lit` is static, the README's `s` bit. */
const long = (tttt, O) => ({
    heap: [`0111_1111_1111_${tttt}_p…p_10`, { p: ref(O) }],
    lit: [`1111_1111_1111_${tttt}_p…p_10`, { p: stat(O) }],
})

export const any = bits(64, {
    number: f64c,
    boolean: ['b111_1111_1111_0…0_0001_0000', { b: bool }],
    undefined: '0111_1111_1111_0…0_0010_0000',
    null: '0111_1111_1111_0…0_0011_0000',
    string: {
        empty: '0111_1111_1111_0…0_0000_1000',
        short: {
            s1x16: row(16, 1),
            s2x16: row(16, 2),
            s4x7: row(7, 4),
            s5x7: row(7, 5),
            s6x7: row(7, 6),
            s3x16: ['0111_1111_1111_u…u_0100', { u: array(u16, 3) }],
            s8x6: ['0111_1111_1111_u…u_1100', { u: array(named('Id6', u(6)), 8) }],
            s7x7: ['1111_1111_1111_u…u_100', { u: array(u(7), 7) }],
        },
        long: long('0100', StrObj),
    },
    bigint: {
        short: ['v111_1111_1111_v…v_1', { v: i(52) }],
        long: long('0101', BigObj),
    },
    array: long('0111', ArrObj),
    object: long('0011', ObjObj),
    function: long('0110', FnObj),
})
