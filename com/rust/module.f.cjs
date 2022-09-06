const types = require('../types/module.f.cjs')
const { paramList } = types
const text = require('../../text/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { flat, map, flatMap } = list
const { entries } = Object
const { fn } = require('../../types/function/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')

/** @type {(field: string) => string} */
const rustField = field => `pub ${field},`

const mapRustField = map(rustField)

/** @type {(b: list.Thunk<string>) => (name: string) => text.Block} */
const rustStruct = b => name => [`#[repr(C)]`, `pub struct ${name} {`, mapRustField(b), `}`]

const commaJoin = join(', ')

/** @type {(name: string) => string} */
const ref = name => `${name}::Ref`

/** @type {(name: string) => string} */
const obj = name => `&${name}::Object`

const self = ['&self']

/** @type {(p: types.Field) => string} */
const paramName = ([n]) => n

/** @type {(p: types.FieldArray) => string} */
const call = p => commaJoin(flat([['self'], map(paramName)(paramList(p))]))

/** @type {(m: types.Method) => string} */
const assign = ([n]) => `${n}: Self::${n},`

const mapAssign = map(assign)

const super_ = 'super::'

/** @type {(library: types.Library) => text.Block} */
const rust = library => {

    /** @type {(p: string) => (o: (_: string) => string) => (t: types.Type) => string} */
    const type = p => {
        /** @type {(o: (_: string) => string) => (t: types.Type) => string} */
        const f = o => t => {
            if (typeof t === 'string') { return t }
            if (t.length === 2) { return `*const ${f(ref)(t[1])}` }
            const [id] = t
            const fullId = `${p}${id}`
            return library[id].interface === undefined ? fullId : o(fullId)
        }
        return f
    }

    /** @type {(p: string) => (o: (_: string) => string) => (f: types.Field) => string} */
    const pf = p => o => ([name, t]) => `${name}: ${type(p)(o)(t)}`

    const param = pf(super_)(obj)

    const mapParam = map(param)

    const mapField = map(pf('')(ref))

    /** @type {(fa: types.FieldArray) => (name: string) => text.Block} */
    const struct = fn(entries)
        .then(mapField)
        .then(rustStruct)
        .result

    /** @type {(first: readonly string[]) => (p: types.FieldArray) => string} */
    const func = first => p => {
        const result = p._
        const resultStr = result === undefined ? '' : ` -> ${type(super_)(ref)(result)}`
        const params = commaJoin(flat([first, mapParam(paramList(p))]))
        return `(${params})${resultStr}`
    }

    /** @type {(m: types.Method) => string} */
    const headerFn = ([n, p]) => `fn ${n}${func(self)(p)}`

    /** @type {(m: types.Method) => string} */
    const traitFn = m => `${headerFn(m)};`

    const mapTraitFn = map(traitFn)

    /** @type {(m: types.Method) => text.Block} */
    const implFn = m => {
        const [n, p] = m
        return [
            `${headerFn(m)} {`,
            [`unsafe { (self.interface().${n})(${call(p)}) }`],
            '}'
        ]
    }

    const flatMapImplFn = flatMap(implFn)

    /** @type {(i: types.Interface) => (name: string) => text.Block} */
    const interface_ = ({ interface: i, guid }) => name => {

        const this_ = ['this: &Object']

        /** @type {(m: types.Method) => string} */
        const virtualFn = ([n, p]) => `${n}: unsafe extern "system" fn${func(this_)(p)}`

        const e = entries(i)

        const nameEx = `${name}Ex`

        const nameVmt = `${name}Vmt`

        return [
            `pub mod ${name} {`,
            [
                'type Object = nanocom::Object<Interface>;',
                'type Ref = nanocom::Ref<Interface>;',
                'type Vmt = nanocom::Vmt<Interface>;',
            ],
            rustStruct(map(virtualFn)(e))('Interface'),
            [   `impl nanocom::Interface for ${name} {`,
                [   `const GUID: nanocom::GUID = 0x${guid.replaceAll('-', '_')};`],
                '}',
                `pub trait ${nameEx} {`,
                mapTraitFn(e),
                '}',
                `impl ${nameEx} for nanocom::Object<${name}> {`,
                flatMapImplFn(e),
                '}',
                `pub trait ${nameVmt}: nanocom::Class<Interface = ${name}>`,
                'where',
                [   `nanocom::CObject<Self>: ${nameEx},`],
                '{',
                [   `const INTERFACE: ${name} = ${name} {`,
                    mapAssign(e),
                    '};'
                ],
                '}'
            ],
            '}'
        ]
    }

    /** @type {(type: object.Entry<types.Definition>) => text.Block} */
    const def = ([name, type]) => (type.interface === undefined ? struct(type.struct) : interface_(type))(name)

    return flat([['#![allow(non_snake_case)]'], flatMap(def)(entries(library))])
}

module.exports = {
    /** @readonly */
    rust,
}
