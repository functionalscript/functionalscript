const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')

/** @type {(name: string) => text.Block} */
const rustStruct = name => [`#[repr(C)]`, `pub struct ${name} {`, `}`]

/** @type {(fa: types.FieldArray) => (name: string) => text.Block} */
const struct = fa => rustStruct

/** @type {(i: types.Interface) => (name: string) => text.Block} */
const interface_ = i => rustStruct

/** @type {(type: object.Entry<types.Definition>) => text.Block} */
const def = ([name, type]) => (type.interface === undefined ? struct(type.struct) : interface_(type))(name)

/** @type {(name: string) => (library: types.Library) => text.Block} */
const rust = name => library => {
    return list.flat(list.map(def)(Object.entries(library)))
}

module.exports = {
    /** @readonly */
    rust,
}
