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

/** @type {(t: types.Type) => string} */
const type = t => typeof(t) === 'string' ? baseType(t) : t.length === 1 ? t[0] : `${type(t[1])}*`

/** @type {(s: types.Field) => text.Item} */
const field = ([name, t]) => `${type(t)} ${name};`

/** @type {(s: types.Struct) => text.Block} */
const defStruct = s => list.map(field)(Object.entries(s.struct))

const result = types.result('void')(type)

/** @type {(p: types.Field) => string} */
const param = ([name, t]) => `${type(t)} ${name}`

/** @type {(m: types.Method) => text.Item} */
const method = ([name, paramArray]) => 
    `virtual ${result(paramArray)} COM_STDCALL ${name}(${list.join(', ')(list.map(param)(types.paramList(paramArray)))}) = 0;`

/** @type {(i: types.Interface) => text.Block} */
const defInterface = i => list.map(method)(Object.entries(i.interface))

/** @type {(kv: obj.Entry<types.Definition>) => text.Block} */
const def = ([name, d]) => d.interface === undefined 
    ? struct(name)(defStruct(d)) 
    : struct(`${name}: ::com::IUnknown`)(defInterface(d))

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cpp = name => library => text.curly
    ('namespace')
    (name)
    (list.flatMap(def)(Object.entries(library)))

module.exports = {
    /** @readonly */
    cpp,
}