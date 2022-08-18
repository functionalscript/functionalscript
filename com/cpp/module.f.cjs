const types = require('../types/module.f.cjs')
const { paramList } = types
const text = require('../../text/module.f.cjs')
const obj = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { map, flatMap } = list
const { join } = require('../../types/string/module.f.cjs')
const { entries } =  Object

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
    bool: '::com::BOOL',
}

/** @type {(t: types.BaseType) => string} */
const baseType = t => baseTypeMap[t]

const resultVoid = types.result('void')

const namespace = text.curly('namespace')

/** @type {(name: string) => (lib: types.Library) => text.Block} */
const cpp = name => lib => {

    /** @type {(i: (t: string) => string) => (t: types.Type) => string} */
    const objectType = i => t => {
        if (typeof (t) === 'string') { return baseType(t) }
        if (t.length === 2) { return `${type(t[1])}*` }
        const [id] = t
        if (lib[id].interface === undefined) { return id }
        return i(id)
    }

    const type = objectType(id => `::com::ref<${id}>`)

    /** @type {(s: types.Field) => text.Item} */
    const field = ([name, t]) => `${type(t)} ${name};`

    const mapField = map(field)

    /** @type {(s: types.Struct) => text.Block} */
    const defStruct = s => mapField(entries(s.struct))

    /** @type {(fa: types.FieldArray) => string} */
    const cppResult = resultVoid(type)

    /** @type {(p: types.Field) => string} */
    const param = ([name, t]) => `${objectType(id => `${id}&`)(t)} ${name}`

    const mapParam = map(param)

    /** @type {(m: types.Method) => text.Item} */
    const method = ([name, paramArray]) =>
        `virtual ${cppResult(paramArray)} COM_STDCALL ${name}(${join(', ')(mapParam(paramList(paramArray)))}) = 0;`

    const mapMethod = map(method)

    /** @type {(i: types.Interface) => text.Block} */
    const defInterface = i => mapMethod(entries(i.interface))

    /** @type {(kv: obj.Entry<types.Definition>) => text.Block} */
    const def = ([name, d]) => d.interface === undefined
        ? struct(name)(defStruct(d))
        : struct(`${name}: ::com::IUnknown`)(defInterface(d))

    return list.flat([
        ['#pragma once', ''],
        namespace(name)(flatMap(def)(entries(lib)))
    ])
}

module.exports = {
    /** @readonly */
    cpp,
}