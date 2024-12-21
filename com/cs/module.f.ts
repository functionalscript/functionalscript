/**
 * This module generates C# code blocks for COM interop from a high-level type library definition.
 *
 * The module maps type definitions (e.g., structs, interfaces, and methods) into C# constructs
 * with appropriate attributes for COM interop, such as `[StructLayout]`, `[Guid]`, and `[InterfaceType]`.
 */
import * as types from '../types/module.f.ts'
const { result, paramList } = types
import * as text from '../../text/module.f.ts'
const { curly } = text
import * as list from '../../types/list/module.f.mjs'
const { flat, map, some, flatMap } = list
import * as string from '../../types/string/module.f.ts'
const { join } = string
import * as O from '../../types/object/module.f.ts'
const { entries } = Object

const using
    : (v: string) => string
    = v => `using ${v};`

const typeDef
    :   (attributes: list.List<string>) =>
        (type: string) =>
        (name: string) =>
        (body: text.Block) =>
        list.List<text.Item>
    = attributes => type => name => body =>
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

const baseType
    : (t: types.BaseType) => string
    = t => baseTypeMap[t]

const unsafe
    : (isUnsafe: boolean) => string
    = isUnsafe => isUnsafe ? 'unsafe ' : ''

const fullType
    : (t: types.Type) => readonly[boolean, string]
    = t =>
    typeof (t) === 'string' ? [false, baseType(t)] :
        t.length === 1 ? [false, t[0]] :
            [true, `${type(t[1])}*`]

const type
    : (m: types.Type) => string
    = t => fullType(t)[1]

const param
    : (f: types.Field) => string
    = ([name, t]) => `${type(t)} ${name}`

const mapParam = map(param)

const field
    : (f: types.Field) => string
    = ([name, comType]) => {
    const [isUnsafe, t] = fullType(comType)
    return `public ${unsafe(isUnsafe)}${t} ${name};`
}

const isUnsafeField
    : (field: types.Field) => boolean
    = field => fullType(field[1])[0]

const mapIsUnsafeField = map(isUnsafeField)

const resultVoid = result('void')

const joinComma = join(', ')

const method
    : (e: O.Entry<types.FieldArray>) => readonly string[]
    = ([name, m]) => {

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

const def
    : (e: O.Entry<types.Definition>) => list.List<text.Item>
    = ([n, d]) => {
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

/** @type {text.Block} */
const header = [
    using('System'),
    using('System.Runtime.InteropServices'),
    ''
]

/**
 * Generates the C# code for a library.
 */
export const cs
    : (name: string) => (library: types.Library) => text.Block
    = name => library => {
    const v = flatMapDef(entries(library))
    const ns = namespace(name)(v)
    return flat([header, ns])
}
