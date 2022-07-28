const types = require('../types/main.f.js')
const text = require('../../text/main.f.js')
const list = require('../../types/list/main.f.js')
const obj = require('../../types/object/main.f.js')

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
        list.map(v => `[${v}]`)(attributes),
        csBlock(`public ${type}`)(name)(body)
    ])

/** @type {(t: types.BaseType) => string} */
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

/** @type {(isUnsafe: boolean) => string} */
const unsafe = isUnsafe => isUnsafe ? 'unsafe ' : ''

/** @type {(t: types.Type) => readonly[boolean, string]} */
const csType = t =>
    typeof (t) === 'string' ? [false, csBaseType(t)] :
        t.length === 1 ? [false, t[0]] :
            [true, `${csType(t[1])[1]}*`]

/** @type {(f: types.Field) => string} */
const csParam = ([name, type]) => `${csType(type)[1]} ${name}`

/** @type {(f: types.Field) => string} */
const csField = ([name, type]) => {
    const [isUnsafe, t] = csType(type)
    return `public ${unsafe(isUnsafe)}${t} ${name};`
}

/** @type {(m: types.FieldArray) => readonly[boolean, string]} */
const csResult = m => m._ === undefined ? [false, 'void'] : csType(m._)

/** @type {(field: types.Field) => boolean} */
const isUnsafeField = field => csType(field[1])[0]

/** @type {(kv: obj.Entry<types.Type>) => boolean} */
const isParam = kv => kv[0] !== '_'

/** @type {(e: obj.Entry<types.FieldArray>) => readonly string[]} */
const csMethod = ([name, m]) => {
    const result = csResult(m)
    const paramArray = list.filter(isParam)(Object.entries(m))
    const isUnsafe = result[0] || list.some(list.map(isUnsafeField)(paramArray))
    return [
        '[PreserveSig]',
        `${unsafe(isUnsafe)}${result[1]} ${name}(${list.join(', ')(list.map(csParam)(paramArray))});`
    ]
}

/** @type {(e: obj.Entry<types.Definition>) => list.List<text.Item>} */
const csDef = ([n, d]) => {
    const i = d.interface
    return i === undefined ?
        csTypeDef
            (['StructLayout(LayoutKind.Sequential)'])
            ('struct')
            (n)
            (() => list.map(csField)(Object.entries(d.struct))) :
        csTypeDef
            ([`Guid("${d.guid}")`, 'InterfaceType(ComInterfaceType.InterfaceIsIUnknown)'])
            ('interface')
            (n)
            (() => list.flatMap(csMethod)(Object.entries(d.interface)))
}

/** @type {(name: string) => (library: types.Library) => text.Block} */
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
