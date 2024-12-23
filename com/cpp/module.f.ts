/**
 * This module generates C++ code blocks, including structs, interfaces, and method headers,
 * based on a COM library of type definitions.
 */

import {
    paramList,
    result,
    type BaseType,
    type Definition,
    type Field,
    type FieldArray,
    type Interface,
    type Library,
    type Method,
    type Struct,
    type Type,
} from '../types/module.f.ts'
import * as text from '../../text/module.f.ts'
import * as O from '../../types/object/module.f.ts'
import { map, flatMap, flat } from '../../types/list/module.f.ts'
import { join } from '../../types/string/module.f.ts'

const { entries } = Object

const struct = (name: string) => (body: text.Block): text.Block =>
    [`struct ${name}`, '{', body, '};']

const baseTypeMap = {
    u8: 'uint8_t',
    i8: 'int8_t',
    u16: 'uint16_t',
    i16: 'int16_t',
    u32: 'uint32_t',
    i32: 'int32_t',
    u64: 'uint64_t',
    i64: 'int64_t',
    usize: 'size_t',
    isize: 'ptrdiff_t',
    f32: 'float',
    f64: 'double',
    bool: 'bool',
}

const baseType = (t: BaseType) => baseTypeMap[t]

const resultVoid = result('void')

const namespace = text.curly('namespace')

const comRef = (id: string): string => `::nanocom::ref<${id}>`

const ptr = (id: string): string => `${id} const*`

const ref = (id: string): string => `${id} const&`

const paramName = ([name]: Field): string => name

const mapParamName = map(paramName)

const joinComma = join(', ')

/**
 * Generates the C++ code for a library.
 */
export const cpp = (name: string) => (lib: Library): text.Block => {

    const interface_ = (t: Type) => {
        if (!(t instanceof Array) || t.length !== 1) {
            return null
        }
        const [name] = t
        return 'interface' in lib[name] ? name : null
    }

    const objectType = (i: (t: string) => string) => (t: Type): string => {
        if (typeof (t) === 'string') { return baseType(t) }
        if (t.length === 2) { return `${type(t[1])} const*` }
        const [id] = t
        return 'interface' in lib[id] ? i(id) : id
    }

    const type = objectType(comRef)

    const resultType = objectType(ptr)

    const field
    : (s: Field) => text.Item
    = ([name, t]) => `${type(t)} ${name};`

    const mapField = map(field)

    const defStruct
    : (s: Struct) => text.Block
    = s => mapField(entries(s.struct))

    const cppResult
    : (fa: FieldArray) => string
    = resultVoid(resultType)

    const param
    : (p: Field) => string
    = ([name, t]) => `${objectType(ref)(t)} ${name}`

    const mapParam = map(param)

    const methodHeader
        : (result: string) => (paramArrayStr: string) => (name: string) => text.Item
        = result => paramArrayStr => name =>
            `virtual ${result} ${name}${paramArrayStr} const noexcept = 0;`

    const method
    : (m: Method) => readonly text.Item[]
    = ([name, paramArray]) => {

        const result = cppResult(paramArray)
        const paramL = paramList(paramArray)
        const paramArrayStr = `(${joinComma(mapParam(paramL))})`
        const m = methodHeader(result)(paramArrayStr)
        const resultName = interface_(paramArray._)
        if (resultName === null) {
            return [m(name)]
        }
        return [
            m(`${name}_`),
            `${comRef(resultName)} ${name}${paramArrayStr} const noexcept`,
            '{',
            [`return ::nanocom::move_to_ref(${name}_(${joinComma(mapParamName(paramL))}));`],
            '}',
        ]
    }

    const mapMethod = flatMap(method)

    const defInterface
    : (i: Interface) => text.Block
    = ({ guid, interface: i }) => {

        const g = guid.replaceAll('-', '');
        const lo = g.substring(0, 16);
        const hi = g.substring(16);
        return flat([
            [`constexpr static ::nanocom::GUID const guid = ::nanocom::GUID(0x${lo}, 0x${hi});`],
            mapMethod(entries(i))
        ])
    }

    const def
    : (kv: O.Entry<Definition>) => text.Block
    = ([name, d]) => 'interface' in d
        ? [
            `class ${name} : public ::nanocom::IUnknown`,
            '{',
            'public:',
            defInterface(d),
            '};'
        ]
        : struct(name)(defStruct(d))

    const forward
    : (kv: O.Entry<Definition>) => text.Block
    = ([name]) => [`struct ${name};`]

    const e = entries(lib)

    return flat([
        ['#pragma once', ''],
        namespace(name)(flat([flatMap(forward)(e), flatMap(def)(e)]))
    ])
}
