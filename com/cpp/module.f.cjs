const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')
const obj = require('../../types/object/module.f.cjs')
const { list } = require('../../types/module.f.cjs')

/** @type {(name: string) => (body: text.Block) => text.Block} */
const struct = name => body => [`struct ${name}`, '{', body, '};']

/** @type {(t: types.BaseType) => string} */
const baseType = t => {
    switch (t) {
        case 'u8': return 'uint8_t'
        case 'i8': return 'int8_t'
        case 'u16': return 'uint16_t'
        case 'i16': return 'int16_t'
        case 'u32': return 'uint32_t'
        case 'i32': return 'int32_t'
        case 'u64': return 'uint64_t'
        case 'i64': return 'int64_t'
        case 'usize': return 'size_t'
        case 'isize': return 'ptrdiff_t'
        case 'f32': return 'float'
        case 'f64': return 'double'
        case 'bool': return '::com::BOOL'
    }
}

/** @type {(lib: types.Library) => (t: string) => string} */
const typeRef = lib => t => {
    const d = lib[t]
    return d.interface === undefined ? t : `${t}*`
}

/** @type {(lib: types.Library) => (t: types.Type) => string} */
const type = lib => t => typeof(t) === 'string' ? baseType(t) : t.length === 1 ? typeRef(lib)(t[0]) : `${type(lib)(t[1])}*`

/** @type {(lib: types.Library) => (s: types.Field) => text.Item} */
const field = lib => ([name, t]) => `${type(lib)(t)} ${name};`

/** @type {(lib: types.Library) => (s: types.Struct) => text.Block} */
const defStruct = lib => s => list.map(field(lib))(Object.entries(s.struct))

/** @type {(lib: types.Library) => (fa: types.FieldArray) => string} */
const result = lib => types.result('void')(type(lib))

/** @type {(lib: types.Library) => (p: types.Field) => string} */
const param = lib => ([name, t]) => `${type(lib)(t)} ${name}`

/** @type {(lib: types.Library) => (m: types.Method) => text.Item} */
const method = lib => ([name, paramArray]) => 
    `virtual ${result(lib)(paramArray)} COM_STDCALL ${name}(${list.join(', ')(list.map(param(lib))(types.paramList(paramArray)))}) = 0;`

/** @type {(lib: types.Library) => (i: types.Interface) => text.Block} */
const defInterface = lib => i => list.map(method(lib))(Object.entries(i.interface))

/** @type {(lib: types.Library) => (kv: obj.Entry<types.Definition>) => text.Block} */
const def = lib => ([name, d]) => d.interface === undefined 
    ? struct(name)(defStruct(lib)(d)) 
    : struct(`${name}: ::com::IUnknown`)(defInterface(lib)(d))

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cpp = name => library => text.curly
    ('namespace')
    (name)
    (list.flatMap(def(library))(Object.entries(library)))

module.exports = {
    /** @readonly */
    cpp,
}