/**
 * This module generates C# code blocks for COM interop from a high-level type library definition.
 *
 * The module maps type definitions (e.g., structs, interfaces, and methods) into C# constructs
 * with appropriate attributes for COM interop, such as `[StructLayout]`, `[Guid]`, and `[InterfaceType]`.
 */
import {
    result,
    paramList,
    type BaseType,
    type Type,
    type Field,
    type FieldArray,
    type Definition,
    type Library,
} from '../types/module.f.ts'
import { curly, type Block, type Item } from '../../text/module.f.ts'
import { flat, map, some, flatMap, type List } from '../../types/list/module.f.ts'
import { join } from '../../types/string/module.f.ts'
import type * as O from '../../types/object/module.f.ts'

const { entries } = Object

const using = (v: string) => `using ${v};`

const typeDef
    = (attributes: List<string>) => (type: string) => (name: string) => (body: Block) =>
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

const baseType = (t: BaseType) => baseTypeMap[t]

const unsafe
    : (isUnsafe: boolean) => string
    = isUnsafe => isUnsafe ? 'unsafe ' : ''

const fullType
    : (t: Type) => readonly [boolean, string]
    = t =>
        typeof (t) === 'string' ?
            [false, baseType(t)] :
            t.length === 1 ?
                [false, t[0]] :
                [true, `${type(t[1])}*`]

const type
    : (m: Type) => string
    = t => fullType(t)[1]

const param
    : (f: Field) => string
    = ([name, t]) => `${type(t)} ${name}`

const mapParam = map(param)

const field
    : (f: Field) => string
    = ([name, comType]) => {
        const [isUnsafe, t] = fullType(comType)
        return `public ${unsafe(isUnsafe)}${t} ${name};`
    }

const isUnsafeField
    : (field: Field) => boolean
    = field => fullType(field[1])[0]

const mapIsUnsafeField = map(isUnsafeField)

const resultVoid = result('void')

const joinComma = join(', ')

const method
    : (e: O.Entry<FieldArray>) => readonly string[]
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
    : (e: O.Entry<Definition>) => List<Item>
    = ([n, d]) =>
        !('interface' in d) ?
            struct(n)(mapField(entries(d.struct))) :
            typeDef
                ([`Guid("${d.guid}")`, 'InterfaceType(ComInterfaceType.InterfaceIsIUnknown)'])
                ('interface')
                (n)
                (flatMapMethod(entries(d.interface)))

const flatMapDef = flatMap(def)

const namespace = curly('namespace')

const header: Block = [
    using('System'),
    using('System.Runtime.InteropServices'),
    ''
]

/**
 * Generates the C# code for a library.
 */
export const cs
    : (name: string) => (library: Library) => Block
    = name => library => {
        const v = flatMapDef(entries(library))
        const ns = namespace(name)(v)
        return flat([header, ns])
    }
