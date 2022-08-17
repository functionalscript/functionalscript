const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')
const { curly } = text
const list = require('../../types/list/module.f.cjs')
const { flat, map } = list
const obj = require('../../types/object/module.f.cjs')
const { entries } = Object

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
    flat([
        map(v => `[${v}]`)(attributes),
        curly(`public ${type}`)(name)(body)
    ])

const baseTypeMap = {
    bool: 'bool',
    f32: 'float',
    f64: 'double',
    i16: 'short',
    i32: 'int',
    i64: 'long',
    i8: 'sbyte',
    isize: 'IntPtr',
    u16: 'ushort',
    u32: 'uint',
    u64: 'ulong',
    u8: 'byte',
    usize: 'UIntPtr',    
}

/** @type {(t: types.BaseType) => string} */
const baseType = t => baseTypeMap[t]

/** @type {(isUnsafe: boolean) => string} */
const unsafe = isUnsafe => isUnsafe ? 'unsafe ' : ''

/** @type {(t: types.Type) => readonly[boolean, string]} */
const fullType = t =>
    typeof (t) === 'string' ? [false, baseType(t)] :
        t.length === 1 ? [false, t[0]] :
            [true, `${type(t[1])}*`]

/** @type {(m: types.Type) => string} */
const type = t => fullType(t)[1]

/** @type {(f: types.Field) => string} */
const param = ([name, t]) => `${type(t)} ${name}`

/** @type {(f: types.Field) => string} */
const field = ([name, comType]) => {
    const [isUnsafe, t] = fullType(comType)
    return `public ${unsafe(isUnsafe)}${t} ${name};`
}

/** @type {(field: types.Field) => boolean} */
const isUnsafeField = field => fullType(field[1])[0]

/** @type {(e: obj.Entry<types.FieldArray>) => readonly string[]} */
const method = ([name, m]) => {
    const paramAndResultList = entries(m)
    const pl = types.paramList(m)
    const isUnsafe = list.some(map(isUnsafeField)(paramAndResultList))
    return [
        '[PreserveSig]',
        `${unsafe(isUnsafe)}${types.result('void')(type)(m)} ${name}(${list.join(', ')(map(param)(pl))});`
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
            (map(field)(entries(d.struct))) :
        typeDef
            ([`Guid("${d.guid}")`, 'InterfaceType(ComInterfaceType.InterfaceIsIUnknown)'])
            ('interface')
            (n)
            (list.flatMap(method)(entries(d.interface)))
}

const namespace = curly('namespace')

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cs = name => library => {
    const v = list.flatMap(def)(entries(library))

    /** @type {text.Block} */
    const h = [
        using('System'),
        using('System.Runtime.InteropServices'),
        ''
    ]

    const ns = namespace(name)(() => v)
    return flat([h, ns])
}

module.exports = {
    /** @readonly */
    cs,
}
