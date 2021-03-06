const types = require('../types/main.f.cjs')
const text = require('../../text/main.f.cjs')
const list = require('../../types/list/main.f.cjs')
const obj = require('../../types/object/main.f.cjs')

/** @type {(v: string) => string} */
const using = v => `using ${v};`

/**
 * @type {(attributes: list.List<string>) =>
 *  (type: string) =>
 *  (name: string) =>
 *  (body: text.Block) =>
 *  list.List<text.Item>}
 */
const typeDef = attributes => type => name => body =>
    list.flat([
        list.map(v => `[${v}]`)(attributes),
        text.curly(`public ${type}`)(name)(body)
    ])

/** @type {(t: types.BaseType) => string} */
const baseType = t => {
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
const type = t =>
    typeof (t) === 'string' ? [false, baseType(t)] :
        t.length === 1 ? [false, t[0]] :
            [true, `${type(t[1])[1]}*`]

/** @type {(f: types.Field) => string} */
const param = ([name, t]) => `${type(t)[1]} ${name}`

/** @type {(f: types.Field) => string} */
const field = ([name, comType]) => {
    const [isUnsafe, t] = type(comType)
    return `public ${unsafe(isUnsafe)}${t} ${name};`
}

/** @type {(m: types.FieldArray) => string} */
const result = m => {
    const result = m._
    return result === undefined ? 'void' : type(result)[1]
}

/** @type {(field: types.Field) => boolean} */
const isUnsafeField = field => type(field[1])[0]

/** @type {(kv: obj.Entry<types.Type>) => boolean} */
const isParam = kv => kv[0] !== '_'

/** @type {(e: obj.Entry<types.FieldArray>) => readonly string[]} */
const method = ([name, m]) => {
    const paramAndResultList = Object.entries(m)
    const paramList = list.filter(isParam)(paramAndResultList)
    const isUnsafe = list.some(list.map(isUnsafeField)(paramAndResultList))
    return [
        '[PreserveSig]',
        `${unsafe(isUnsafe)}${result(m)} ${name}(${list.join(', ')(list.map(param)(paramList))});`
    ]
}

/** @type {(e: obj.Entry<types.Definition>) => list.List<text.Item>} */
const def = ([n, d]) => {
    const i = d.interface
    return i === undefined ?
        typeDef
            (['StructLayout(LayoutKind.Sequential)'])
            ('struct')
            (n)
            (list.map(field)(Object.entries(d.struct))) :
        typeDef
            ([`Guid("${d.guid}")`, 'InterfaceType(ComInterfaceType.InterfaceIsIUnknown)'])
            ('interface')
            (n)
            (list.flatMap(method)(Object.entries(d.interface)))
}

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cs = name => library => {
    const v = list.flatMap(def)(Object.entries(library))

    /** @type {text.Block} */
    const h = [
        using('System'),
        using('System.Runtime.InteropServices'),
        ''
    ]

    const ns = text.curly('namespace')(name)(() => v)
    return list.flat([h, ns])
}

module.exports = {
    /** @readonly */
    cs,
}
