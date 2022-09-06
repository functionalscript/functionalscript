const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { flat, map } = list
const { entries } = Object

/** @type {(b: text.Block) => (name: string) => text.Block} */
const rustStruct = b => name => [`#[repr(C)]`, `pub struct ${name} {`, b, `}`]

/** @type {(t: types.BaseType) => string} */
const baseType = t => t

/** @type {(t: types.Id) => string} */
const id = ([t]) => t

/** @type {(t: types.Type) => string} */
const type = t => typeof t === 'string' ? baseType(t) : t.length === 2 ? `*const ${type(t[1])}` : id(t)

/** @type {(f: types.Field) => text.Item} */
const field = ([name, t]) => `${name}: ${type(t)},`

const mapField = map(field)

/** @type {(fa: types.FieldArray) => (name: string) => text.Block} */
const struct = fa => rustStruct(mapField(entries(fa)))

/** @type {(i: types.Interface) => (name: string) => text.Block} */
const interface_ = ({interface: i}) => name => {
    /** @type {(m: types.Method) => string} */
    const method = ([n, m]) => {
        const r = m._
        const s = r === undefined ? '' : ` -> ${type(r)}`
        return `${n}: extern "system" fn(this: &nanocom::Object<${name}>)${s},`
    }
    return rustStruct(map(method)(entries(i)))(name)
}

/** @type {(type: object.Entry<types.Definition>) => text.Block} */
const def = ([name, type]) => (type.interface === undefined ? struct(type.struct) : interface_(type))(name)

const mapDef = map(def)

/** @type {(library: types.Library) => text.Block} */
const rust = library => {
    return flat(mapDef(entries(library)))
}

module.exports = {
    /** @readonly */
    rust,
}
