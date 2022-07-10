const text = require('../text/main.f.js')
// const list = require('../types/list/main.f')
const obj = require('../types/object/main.f.js')

/** @typedef {{readonly[k in string]: Definition}} Library */

/** @typedef {Struct|Interface} Definition */

/** @typedef {{readonly struct: FieldArray}} Struct */

/** @typedef {readonly Field[]} FieldArray */

/** @typedef {[string, Type]} Field */

/**
 * @typedef {{
 *  readonly interface: MethodArray
 *  readonly guid: string
 * }} Interface
 */

/** @typedef {readonly Method[]} MethodArray */

/** @typedef {readonly[string, FieldArray, Type]} Method */

/** @typedef {BaseType|Id|Pointer} Type */

/** @typedef {readonly[string]} Id */

/** @typedef {'u8'|'i8'|'u16'|'i16'|'u32'|'i32'|'u64'|'i64'|'usize'|'isize'|'f32'|'f64'|'bool'|''}  BaseType */

/** @typedef {{readonly '*': Type}} Pointer */

/** @type {(name: string) => (library: Library) => text.Block} */
const cs = name => library => {
    /** @type {(v: string) => string} */
    const using = v => `using ${v};`

    const v = Object.entries(library)

    return [
        using('System'),
        using('System.Runtime.InteropServices'),
        '',
        `namespace ${name}`,
        `{`,
        [
        ],
        `}`,
    ]
}

module.exports = {
    /** @readonly */
    cs,
}
