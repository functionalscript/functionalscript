const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')
const obj = require('../../types/object/module.f.cjs')
const { list } = require('../../types/module.f.cjs')

/** @type {(name: string) => (body: text.Block) => text.Block} */
const struct = name => body => [`struct ${name}`, '{', body, '};']

/** @type {(t: types.Type) => string} */
const type = t => typeof(t) === 'string' ? 'int' : 'int*'

/** @type {(s: types.Field) => text.Item} */
const field = ([name, t]) => `${type(t)} ${name};`

/** @type {(s: types.Struct) => text.Block} */
const defStruct = s => list.map(field)(Object.entries(s.struct))

/** @type {(m: types.FieldArray) => string} */
const result = m => {
    const result = m._
    return result === undefined ? 'void' : type(result)
}

/** @type {(m: types.Method) => text.Item} */
const method = ([name, paramArray]) => `virtual ${result(paramArray)} COM_STDCALL ${name}() = 0;`

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