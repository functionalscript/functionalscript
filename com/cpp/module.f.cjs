const types = require('../types/module.f.cjs')
const { paramList } = types
const text = require('../../text/module.f.cjs')
const obj = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { map, flatMap, flat } = list
const { join } = require('../../types/string/module.f.cjs')
const { entries } = Object

/** @type {(name: string) => (body: text.Block) => text.Block} */
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

/** @type {(name: string) => (lib: types.Library) => text.Block} */
const cpp = name => lib => {

    /** @type {(t: types.Type) => string|undefined} */
    const interface_ = t => {
        if (!(t instanceof Array) || t.length !== 1) {
            return undefined
        }
        const [name] = t
        return lib[name].interface !== undefined ? name : undefined
    }

    /** @type {(i: (t: string) => string) => (t: types.Type) => string} */
    const objectType = i => t => {
        if (typeof (t) === 'string') { return baseType(t) }
        if (t.length === 2) { return `${type(t[1])} const*` }
        const [id] = t
        if (lib[id].interface === undefined) { return id }
        return i(id)
    }

    const type = objectType(comRef)

    const resultType = objectType(ptr)

    /** @type {(s: types.Field) => text.Item} */
    const field = ([name, t]) => `${type(t)} ${name};`

    const mapField = map(field)

    /** @type {(s: types.Struct) => text.Block} */
    const defStruct = s => mapField(entries(s.struct))

    /** @type {(fa: types.FieldArray) => string} */
    const cppResult = resultVoid(resultType)

    /** @type {(p: types.Field) => string} */
    const param = ([name, t]) => `${objectType(ref)(t)} ${name}`

    const mapParam = map(param)

    /** @type {(result: string) => (paramArrayStr: string) => (name: string) => text.Item} */
    const methodHeader = result => paramArrayStr => name =>
        `virtual ${result} NANOCOM_STDCALL ${name}${paramArrayStr} const noexcept = 0;`

    /** @type {(m: types.Method) => readonly text.Item[]} */
    const method = ([name, paramArray]) => {
        const result = cppResult(paramArray)
        const paramL = paramList(paramArray)
        const paramArrayStr = `(${joinComma(mapParam(paramL))})`
        const m = methodHeader(result)(paramArrayStr)
        const resultName = interface_(paramArray._)
        if (resultName === undefined) {
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

    /** @type {(i: types.Interface) => text.Block} */
    const defInterface = ({ guid, interface: i }) => {
        const g = guid.replaceAll('-', '');
        const lo = g.substring(0, 16);
        const hi = g.substring(16);
        return flat([
            [`constexpr static ::nanocom::GUID const guid = ::nanocom::GUID(0x${lo}, 0x${hi});`],
            mapMethod(entries(i))
        ])
    }

    /** @type {(kv: obj.Entry<types.Definition>) => text.Block} */
    const def = ([name, d]) => d.interface === undefined
        ? struct(name)(defStruct(d))
        : [`class ${name} : public ::nanocom::IUnknown`, '{', 'public:', defInterface(d), '};']

    /** @type {(kv: obj.Entry<types.Definition>) => text.Block} */
    const forward = ([name]) => [`struct ${name};`]

    const e = entries(lib)

    return flat([
        ['#pragma once', ''],
        namespace(name)(flat([flatMap(forward)(e), flatMap(def)(e)]))
    ])
}

module.exports = {
    /** @readonly */
    cpp,
}