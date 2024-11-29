import types, * as typesT from '../types/module.f.mjs'
const { result, paramList } = types
import text, * as textT from '../../text/module.f.mjs'
const { curly } = text
import list from '../../types/list/module.f.cjs'
const { flat, map, some, flatMap } = list
import { join } from '../../types/string/module.f.cjs'
import obj from '../../types/object/module.f.cjs'
const { entries } = Object

/** @type {(v: string) => string} */
const using = v => `using ${v};`

/**
 * @type {(attributes: list.List<string>) =>
 *  (type: string) =>
 *  (name: string) =>
 *  (body: textT.Block) =>
 *  list.List<textT.Item>}
 */
const typeDef = attributes => type => name => body =>
    flat([
        map(v => `[${v}]`)(attributes),
        curly(`public ${type}`)(name)(body)
    ])

const baseTypeMap = {
    bool: 'byte',
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

/** @type {(t: typesT.BaseType) => string} */
const baseType = t => baseTypeMap[t]

/** @type {(isUnsafe: boolean) => string} */
const unsafe = isUnsafe => isUnsafe ? 'unsafe ' : ''

/** @type {(t: typesT.Type) => readonly[boolean, string]} */
const fullType = t =>
    typeof (t) === 'string' ? [false, baseType(t)] :
        t.length === 1 ? [false, t[0]] :
            [true, `${type(t[1])}*`]

/** @type {(m: typesT.Type) => string} */
const type = t => fullType(t)[1]

/** @type {(f: typesT.Field) => string} */
const param = ([name, t]) => `${type(t)} ${name}`

const mapParam = map(param)

/** @type {(f: typesT.Field) => string} */
const field = ([name, comType]) => {
    const [isUnsafe, t] = fullType(comType)
    return `public ${unsafe(isUnsafe)}${t} ${name};`
}

/** @type {(field: typesT.Field) => boolean} */
const isUnsafeField = field => fullType(field[1])[0]

const mapIsUnsafeField = map(isUnsafeField)

const resultVoid = result('void')

const joinComma = join(', ')

/** @type {(e: obj.Entry<typesT.FieldArray>) => readonly string[]} */
const method = ([name, m]) => {
    const paramAndResultList = entries(m)
    const pl = paramList(m)
    const isUnsafe = some(mapIsUnsafeField(paramAndResultList))
    return [
        '[PreserveSig]',
        `${unsafe(isUnsafe)}${resultVoid(type)(m)} ${name}(${joinComma(mapParam(pl))});`
    ]
}

const struct = typeDef
    (['StructLayout(LayoutKind.Sequential)'])
    ('struct')

const mapField = map(field)

const flatMapMethod = flatMap(method)

/** @type {(e: obj.Entry<typesT.Definition>) => list.List<textT.Item>} */
const def = ([n, d]) => {
    return !('interface' in d) ?
        struct(n)(mapField(entries(d.struct))) :
        typeDef
            ([`Guid("${d.guid}")`, 'InterfaceType(ComInterfaceType.InterfaceIsIUnknown)'])
            ('interface')
            (n)
            (flatMapMethod(entries(d.interface)))
}

const flatMapDef = flatMap(def)

const namespace = curly('namespace')

/** @type {textT.Block} */
const header = [
    using('System'),
    using('System.Runtime.InteropServices'),
    ''
]

/** @type {(name: string) => (library: typesT.Library) => textT.Block} */
const cs = name => library => {
    const v = flatMapDef(entries(library))
    const ns = namespace(name)(v)
    return flat([header, ns])
}

export default {
    /** @readonly */
    cs,
}
