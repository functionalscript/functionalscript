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

const commaJoin = join(', ')

const ref = 'nanocom::Ref'

/** @type {(library: types.Library) => text.Block} */
const rust = library => {

    // /** @type {(o: string) => (t: string) => string} */
    // const id = o => t =>

    /** @type {(o: string) => (t: types.Type) => string} */
    const type = o => t => {
        if (typeof t === 'string') { return baseType(t) }
        if (t.length === 2) { return `*const ${type(ref)(t[1])}` }
        const [id] = t
        return library[id].interface === undefined ? id : `${o}<${id}>`
    }

    /** @type {(o: string) => (f: types.Field) => string} */
    const pf = o => ([name, t]) => `${name}: ${type(o)(t)}`

    const param = pf('&nanocom::Object')

    const mapParam = map(param)

    /** @type {(f: types.Field) => string} */
    const field = f => `${pf(ref)(f)},`

    const mapField = map(field)

    /** @type {(fa: types.FieldArray) => (name: string) => text.Block} */
    const struct = fn(entries)
        .then(mapField)
        .then(rustStruct)
        .result

    /** @type {(i: types.Interface) => (name: string) => text.Block} */
    const interface_ = ({ interface: i }) => name => {

        const this_ = [param(['this', [name]])]

        /** @type {(m: types.Method) => string} */
        const method = ([n, p]) => {
            const result = p._
            const resultStr = result === undefined ? '' : ` -> ${type(ref)(result)}`
            const params = commaJoin(flat([this_, mapParam(paramList(p))]))
            return `${n}: extern "system" fn(${params})${resultStr},`
        }

        return rustStruct(map(method)(entries(i)))(name)
    }

    /** @type {(type: object.Entry<types.Definition>) => text.Block} */
    const def = ([name, type]) => (type.interface === undefined ? struct(type.struct) : interface_(type))(name)

    return flat(map(def)(entries(library)))
}

module.exports = {
    /** @readonly */
    rust,
}
