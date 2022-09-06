const types = require('../types/module.f.cjs')
const { paramList } = types
const text = require('../../text/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { flat, map } = list
const { entries } = Object
const { fn } = require('../../types/function/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')

/** @type {(b: text.Block) => (name: string) => text.Block} */
const rustStruct = b => name => [`#[repr(C)]`, `pub struct ${name} {`, b, `}`]

/** @type {(t: types.BaseType) => string} */
const baseType = t => t

/** @type {(t: types.Id) => string} */
const id = ([t]) => t

/** @type {(t: types.Type) => string} */
const type = t => typeof t === 'string' ? baseType(t) : t.length === 2 ? `*const ${type(t[1])}` : id(t)

/** @type {(f: types.Field) => string} */
const param = ([name, t]) => `${name}: ${type(t)}`

const mapParam = map(param)

/** @type {(f: types.Field) => string} */
const field = f => `${param(f)},`

const mapField = map(field)

/** @type {(fa: types.FieldArray) => (name: string) => text.Block} */
const struct = fa => rustStruct(mapField(entries(fa)))

const commaJoin = join(', ')

/** @type {(i: types.Interface) => (name: string) => text.Block} */
const interface_ = ({interface: i}) => name => {
    const this_ = [`this: &nanocom::Object<${name}>`]
    /** @type {(m: types.Method) => string} */
    const method = ([n, p]) => {
        const r = p._
        const s = r === undefined ? '' : ` -> ${type(r)}`
        const rp = commaJoin(flat([this_, mapParam(paramList(p))]))
        return `${n}: extern "system" fn(${rp})${s},`
    }
    return rustStruct(map(method)(entries(i)))(name)
}

/** @type {(type: object.Entry<types.Definition>) => text.Block} */
const def = ([name, type]) => (type.interface === undefined ? struct(type.struct) : interface_(type))(name)

/** @type {(library: types.Library) => text.Block} */
const rust = fn(entries).then(map(def)).then(flat).result

module.exports = {
    /** @readonly */
    rust,
}
