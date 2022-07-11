const text = require('../text/main.f.js')
const list = require('../types/list/main.f')
const obj = require('../types/object/main.f.js')

/** @typedef {{readonly[k in string]: Definition}} Library */

/** @typedef {Struct|Interface} Definition */

/**
 * @typedef {{
 *  readonly interface?: undefined
 *  readonly struct: FieldArray
 * }} Struct
 */

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

/** @type {(v: string) => string} */
const csUsing = v => `using ${v};`

/** @type {(type: string) => (name: string) => (body: text.Block) => text.Block} */
const csBlock = type => name => body => [`${type} ${name}`, '{', body, '}']

/** @type {(attributes: string) => (type: string) => (name: string) => (body: text.Block) => list.List<text.Item>} */
const csType = attributes => type => name => body => list.flat([[`[${attributes}]`], csBlock(`public ${type}`)(name)(body)])

/** @type {(e: obj.Entry<Definition>) => list.List<text.Item>} */
const csDef = ([n, d]) => {
    const i = d.interface
    return i === undefined ?
        csType('StructLayout(LayoutKind.Sequential)')('struct')(n)([]) :
        csType(`Guid("${d.guid}"),InterfaceType(ComInterfaceType.InterfaceIsUnknown)`)('interface')(n)([])
}

/** @type {(name: string) => (library: Library) => text.Block} */
const cs = name => library => {
    const v = list.flatMap(csDef)(Object.entries(library))

    /** @type {text.Block} */
    const h = [
        csUsing('System'),
        csUsing('System.Runtime.InteropServices'),
        ''
    ]

    const ns = csBlock('namespace')(name)(() => v)
    return () => list.flat([h, ns])
}

module.exports = {
    /** @readonly */
    cs,
}
