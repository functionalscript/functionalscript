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

/** @typedef {readonly[string, FieldArray, Type]} GetMethod */

/** @typedef {readonly[string, FieldArray]} SetMethod */

/** @typedef {GetMethod|SetMethod} Method */

/** @typedef {BaseType|Id|Pointer} Type */

/** @typedef {readonly[string]} Id */

/** @typedef {'u8'|'i8'|'u16'|'i16'|'u32'|'i32'|'u64'|'i64'|'usize'|'isize'|'f32'|'f64'|'bool'}  BaseType */

/** @typedef {{readonly '*': Type}} Pointer */

/** @type {(v: string) => string} */
const csUsing = v => `using ${v};`

/** @type {(type: string) => (name: string) => (body: text.Block) => text.Block} */
const csBlock = type => name => body => [`${type} ${name}`, '{', body, '}']

/**
 * @type {(attributes: list.List<string>) =>
 *  (type: string) =>
 *  (name: string) =>
 *  (body: text.Block) =>
 *  list.List<text.Item>}
 */
const csTypeDef = attributes => type => name => body =>
    list.flat([
        list.map(v=>`[${v}]`)(attributes),
        csBlock(`public ${type}`)(name)(body)
    ])

/** @type {(t: BaseType) => string} */
const csBaseType = t => {
    switch (t) {
        case 'bool': return 'bool'
        case 'f32': return 'float'
        case 'f64': return 'double'
        case 'i16': return 'short'
        case 'i32': return 'int'
        case 'i64': return 'long'
        case 'i8': return 'sbyte'
        case 'isize': return 'IntPtr'
        case 'u16': return 'ushort'
        case 'u32': return 'uint'
        case 'u64': return 'ulong'
        case 'u8': return 'byte'
        case 'usize': return 'UIntPtr'
    }
}

/** @type {(t: Type) => string} */
const csType = t =>
    typeof(t) === 'string' ? csBaseType(t) :
    t instanceof Array ? t[0] :
    `${csType(t['*'])}*`

/** @type {(f: Field) => string} */
const csParam = ([name, type]) => `${csType(type)} ${name}`

/** @type {(f: Field) => string} */
const csField = f => `public ${csParam(f)};`

/** @type {(m: Method) => string} */
const csResult = m => m.length === 2 ? 'void' : csType(m[2])

/** @type {(m: Method) => readonly string[]} */
const csMethod = m => [
    '[PreserveSig]',
    `${csResult(m)} ${m[0]}(${list.join(',')(list.map(csParam)(m[1]))});`
]

/** @type {(e: obj.Entry<Definition>) => list.List<text.Item>} */
const csDef = ([n, d]) => {
    const i = d.interface
    return i === undefined ?
        csTypeDef
            (['StructLayout(LayoutKind.Sequential)'])
            ('struct')
            (n)
            (() => list.map(csField)(d.struct)) :
        csTypeDef
            ([`Guid("${d.guid}")`,'InterfaceType(ComInterfaceType.InterfaceIsUnknown)'])
            ('interface')
            (n)
            (() => list.flatMap(csMethod)(d.interface))
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
