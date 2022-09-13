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

/** @type {(p: types.FieldArray) => list.Thunk<string>} */
const callList = p => map(paramName)(paramList(p))

/** @type {(p: types.FieldArray) => string} */
const call = p => commaJoin(callList(p))

/** @type {(p: types.FieldArray) => string} */
const virtualCall = p => commaJoin(flat([['self'], callList(p)]))

const super_ = 'super::'

/** @type {(m: types.Method) => string} */
const assign = ([n]) => `${n}: Self::${n},`

const mapAssign = map(assign)

const this_ = ['this: &Object']

/** @type {(n: string) => string} */
const rustType = n => `pub type ${n} = nanocom::${n}<Interface>;`

/**
 * @typedef {{
 *  readonly param?: string
 *  readonly trait: string
 *  readonly type: string
 *  readonly content: text.Item
 * }} Impl
 */

/** @type {(impl: Impl) => text.ItemArray} */
const rustImpl = ({param, trait, type, content}) => {
    const p = param === undefined ? '' : `<${param}>`
    return [
        `impl${p} ${trait} for ${type} {`,
        content,
        '}'
    ]
}

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

    /** @type {(n: string) => (p: types.FieldArray) => string} */
    const virtualFnType = n => p => `extern "system" fn${n}${func(this_)(p)}`

    /** @type {(m: types.Method) => string} */
    const virtualFn = ([n, p]) => `${n}: unsafe ${virtualFnType('')(p)}`

    const mapVirtualFn = map(virtualFn)

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
            [`unsafe { (self.interface().${n})(${virtualCall(p)}) }`],
            '}'
        ]
    }

    const flatMapImplFn = flatMap(implFn)

    /** @type {(m: types.Method) => text.Block} */
    const impl = ([n, p]) => {
        const type = virtualFnType(` ${n}`)(p)
        return [
            `${type} {`,
            [`unsafe { Self::to_cobject(this) }.${n}(${call(p)})`],
            '}'
        ]
    }

    const flatMapImpl = flatMap(impl)

    /** @type {(i: types.Interface) => (name: string) => text.Block} */
    const interface_ = ({ interface: i, guid }) => name => {

        const e = entries(i)

        return [
            `pub mod ${name} {`,
            [
                rustType('Object'),
                rustType('Ref'),
                rustType('Vmt'),
            ],
            rustStruct(mapVirtualFn(e))('Interface'),
            rustImpl({
                trait: 'nanocom::Interface',
                type: 'Interface',
                content: [`const GUID: nanocom::GUID = 0x${guid.replaceAll('-', '_')};`]
            }),
            [
                'pub trait Ex {',
                mapTraitFn(e),
                '}',
            ],
            rustImpl({
                trait: 'Ex',
                type: 'Object',
                content:flatMapImplFn(e)
            }),
            [   'pub trait ClassEx: nanocom::Class<Interface = Interface>',
                'where',
                [   'nanocom::CObject<Self>: Ex,'],
                '{',
                [   `const INTERFACE: Interface = Interface {`,
                    mapAssign(e),
                    '};'
                ],
                '}'
            ],
            [
                'impl<T: nanocom::Class<Interface = Interface>> ClassEx for T where nanocom::CObject<T>: Ex {}',
            ],
            [   'trait PrivateClassEx: nanocom::Class<Interface = Interface>',
                'where',
                [   'nanocom::CObject<Self>: Ex'],
                `{`,
                flatMapImpl(e),
                `}`,
                'impl<T: nanocom::Class<Interface = Interface>> PrivateClassEx for T where nanocom::CObject<T>: Ex {}',
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
