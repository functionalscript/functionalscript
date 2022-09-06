const types = require('../types/module.f.cjs')
const { paramList } = types
const text = require('../../text/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { flat, map } = list
const { entries } = Object
const { fn } = require('../../types/function/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')

/** @type {(field: string) => string} */
const rustField = field => `pub ${field},`

const mapRustField = map(rustField)

/** @type {(b: list.Thunk<string>) => (name: string) => text.Block} */
const rustStruct = b => name => [`#[repr(C)]`, `pub struct ${name} {`, mapRustField(b), `}`]

const commaJoin = join(', ')

const ref = 'nanocom::Ref'

const self = ['&self']

/** @type {(library: types.Library) => text.Block} */
const rust = library => {

    /** @type {(o: string) => (t: types.Type) => string} */
    const type = o => t => {
        if (typeof t === 'string') { return t }
        if (t.length === 2) { return `*const ${type(ref)(t[1])}` }
        const [id] = t
        return library[id].interface === undefined ? id : `${o}<${id}>`
    }

    /** @type {(o: string) => (f: types.Field) => string} */
    const pf = o => ([name, t]) => `${name}: ${type(o)(t)}`

    const param = pf('&nanocom::Object')

    const mapParam = map(param)

    const mapField = map(pf(ref))

    /** @type {(fa: types.FieldArray) => (name: string) => text.Block} */
    const struct = fn(entries)
        .then(mapField)
        .then(rustStruct)
        .result

    /** @type {(i: types.Interface) => (name: string) => text.Block} */
    const interface_ = ({ interface: i, guid }) => name => {

        const this_ = [param(['this', [name]])]

        /** @type {(first: readonly string[]) => (p: types.FieldArray) => string} */
        const fn = first => p => {
            const result = p._
            const resultStr = result === undefined ? '' : ` -> ${type(ref)(result)}`
            const params = commaJoin(flat([first, mapParam(paramList(p))]))
            return `(${params})${resultStr}`
        }

        /** @type {(m: types.Method) => string} */
        const virtualFn = ([n, p]) => `${n}: unsafe extern "system" fn${fn(this_)(p)}`

        /** @type {(m: types.Method) => string} */
        const traitFn = ([n, p]) => `fn ${n}${fn(self)(p)};`

        const e = entries(i)

        return flat([
            rustStruct(map(virtualFn)(e))(name),
            [   `impl nanocom::Interface for ${name} {`,
                [   `const GUID: nanocom::GUID = 0x${guid.replaceAll('-', '_')};`],
                '}',
                `pub trait ${name}Ex {`,
                map(traitFn)(e),
                '}'
            ]
        ])
    }

    /** @type {(type: object.Entry<types.Definition>) => text.Block} */
    const def = ([name, type]) => (type.interface === undefined ? struct(type.struct) : interface_(type))(name)

    return flat([['#![allow(non_snake_case)]'], flat(map(def)(entries(library)))])
}

module.exports = {
    /** @readonly */
    rust,
}
