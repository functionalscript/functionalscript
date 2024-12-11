// @ts-self-types="./module.f.d.mts"
import * as types from '../types/module.f.mjs'
import text, * as Text from '../../text/module.f.mjs'
import * as O from '../../types/object/module.f.mjs'
import list from '../../types/list/module.f.mjs'
import string from '../../types/string/module.f.mjs'
const { join } = string
const { paramList } = types
const { map, flatMap, flat } = list
const { entries } = Object

/** @type {(name: string) => (body: Text.Block) => Text.Block} */
const struct = name => body => [`struct ${name}`, '{', body, '};']

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

/** @type {(t: types.BaseType) => string} */
const baseType = t => baseTypeMap[t]

const resultVoid = types.result('void')

const namespace = text.curly('namespace')

/** @type {(id: string) => string} */
const comRef = id => `::nanocom::ref<${id}>`

/** @type {(id: string) => string} */
const ptr = id => `${id} const*`

/** @type {(id: string) => string} */
const ref = id => `${id} const&`

/** @type {(p: types.Field) => string} */
const paramName = ([name]) => name

const mapParamName = map(paramName)

const joinComma = join(', ')

/** @type {(name: string) => (lib: types.Library) => Text.Block} */
export const cpp = name => lib => {

    /** @type {(t: types.Type) => string|null} */
    const interface_ = t => {
        if (!(t instanceof Array) || t.length !== 1) {
            return null
        }
        const [name] = t
        return 'interface' in lib[name] ? name : null
    }

    /** @type {(i: (t: string) => string) => (t: types.Type) => string} */
    const objectType = i => t => {
        if (typeof (t) === 'string') { return baseType(t) }
        if (t.length === 2) { return `${type(t[1])} const*` }
        const [id] = t
        return 'interface' in lib[id] ? i(id) : id
    }

    const type = objectType(comRef)

    const resultType = objectType(ptr)

    /** @type {(s: types.Field) => Text.Item} */
    const field = ([name, t]) => `${type(t)} ${name};`

    const mapField = map(field)

    /** @type {(s: types.Struct) => Text.Block} */
    const defStruct = s => mapField(entries(s.struct))

    /** @type {(fa: types.FieldArray) => string} */
    const cppResult = resultVoid(resultType)

    /** @type {(p: types.Field) => string} */
    const param = ([name, t]) => `${objectType(ref)(t)} ${name}`

    const mapParam = map(param)

    /** @type {(result: string) => (paramArrayStr: string) => (name: string) => Text.Item} */
    const methodHeader = result => paramArrayStr => name =>
        `virtual ${result} ${name}${paramArrayStr} const noexcept = 0;`

    /** @type {(m: types.Method) => readonly Text.Item[]} */
    const method = ([name, paramArray]) => {
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

    /** @type {(i: types.Interface) => Text.Block} */
    const defInterface = ({ guid, interface: i }) => {
        const g = guid.replaceAll('-', '');
        const lo = g.substring(0, 16);
        const hi = g.substring(16);
        return flat([
            [`constexpr static ::nanocom::GUID const guid = ::nanocom::GUID(0x${lo}, 0x${hi});`],
            mapMethod(entries(i))
        ])
    }

    /** @type {(kv: O.Entry<types.Definition>) => Text.Block} */
    const def = ([name, d]) => 'interface' in d
        ? [
            `class ${name} : public ::nanocom::IUnknown`,
            '{',
            'public:',
            defInterface(d),
            '};'
        ]
        : struct(name)(defStruct(d))

    /** @type {(kv: O.Entry<types.Definition>) => Text.Block} */
    const forward = ([name]) => [`struct ${name};`]

    const e = entries(lib)

    return flat([
        ['#pragma once', ''],
        namespace(name)(flat([flatMap(forward)(e), flatMap(def)(e)]))
    ])
}
