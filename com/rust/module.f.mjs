// @ts-self-types="./module.f.d.mts"

/**
 * This module generates Rust code for COM interop from a high-level type library definition.
 *
 * The module provides functions to define structs, traits, and implementations in Rust,
 * specifically tailored for `nanocom` interoperation.
 */
import * as types from '../types/module.f.mjs'
const { paramList } = types
import * as Text from '../../text/module.f.mjs'
import * as O from '../../types/object/module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
const { flat, map, flatMap } = list
const { entries } = Object
import * as func from '../../types/function/module.f.mjs'
const { fn } = func
import * as string from '../../types/string/module.f.mjs'
const { join } = string

/** @type {(field: string) => string} */
const rustField = field => `pub ${field},`

const mapRustField = map(rustField)

/** @type {(b: list.Thunk<string>) => (name: string) => Text.Block} */
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
 * @template T
 * @typedef {T|{}} OptionalProperty
 */

/** @typedef {{readonly where: readonly string[]}} Where */

/**
 * @typedef {OptionalProperty<Where> & {readonly content: Text.Block}} WhereContent
 */

/** @type {(h: string) => (wh: WhereContent) => Text.Block} */
const whereContent = h => wh => {
    const w = 'where' in wh ? [
        h,
        `where`,
        mapComma(wh.where),
        '{'
    ]: [`${h} {`]
    const x = [
        wh.content,
        '}',
    ]
    return flat([w, x])
}

/**
 * @typedef {{
 *  readonly param?: string
 *  readonly trait: string
 *  readonly type: string
 *  readonly where?: readonly string[]
 *  readonly content: Text.Block
 * }} Impl
 */

/** @type {(impl: Impl) => Text.Block} */
const rustImpl = i => {
    const p = 'param' in i ? `<${i.param}>` : ''
    const header = `impl${p} ${i.trait} for ${i.type}`
    return whereContent(header)(i)
}

/**
 * @typedef {{
 *  readonly pub?: true
 *  readonly type: string
 *  readonly where?: readonly string[]
 *  readonly content: Text.Block
 * }} Trait
 */

/** @type {(s: string) => string} */
const comma = s => `${s},`

const mapComma = map(comma)

/** @type {(t: Trait) => Text.Block} */
const trait = t => {
    const p = t.pub === true ? 'pub ' : ''
    const h = `${p}trait ${t.type}`
    return whereContent(h)(t)
}

/** @type {(t: Trait) => Text.Block} */
const traitImpl = t => {
    const i = rustImpl({
        param: 'T',
        trait: t.type,
        type: 'T',
        where,
        content: [],
    })
    return flat([trait({ ...t, where }), i])
}

const where = ['Self: nanocom::Class<Interface = Interface>', 'nanocom::CObject<Self>: Ex']

/**
 * Generates Rust code for the given type library.
 *
 * @param {types.Library} library - The library of type definitions to generate Rust code for.
 * @returns {Text.Block} - A block of Rust code representing the library.
 */
export const rust = library => {

    /** @type {(p: string) => (o: (_: string) => string) => (t: types.Type) => string} */
    const type = p => {
        /** @type {(o: (_: string) => string) => (t: types.Type) => string} */
        const f = o => t => {
            if (typeof t === 'string') { return t }
            if (t.length === 2) { return `*const ${f(ref)(t[1])}` }
            const [id] = t
            const fullId = `${p}${id}`
            return 'interface' in library[id] ? o(fullId) : fullId
        }
        return f
    }

    /** @type {(p: string) => (o: (_: string) => string) => (f: types.Field) => string} */
    const pf = p => o => ([name, t]) => `${name}: ${type(p)(o)(t)}`

    const param = pf(super_)(obj)

    const mapParam = map(param)

    const mapField = map(pf('')(ref))

    /** @type {(fa: types.FieldArray) => (name: string) => Text.Block} */
    const struct = fn(entries)
        .then(mapField)
        .then(rustStruct)
        .result

    /** @type {(first: readonly string[]) => (p: types.FieldArray) => string} */
    const func = first => p => {
        const resultStr = '_' in p ? ` -> ${type(super_)(ref)(p._)}` : ''
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

    /** @type {(m: types.Method) => Text.Block} */
    const implFn = m => {
        const [n, p] = m
        return [
            `${headerFn(m)} {`,
            [`unsafe { (self.interface().${n})(${virtualCall(p)}) }`],
            '}'
        ]
    }

    const flatMapImplFn = flatMap(implFn)

    /** @type {(m: types.Method) => Text.Block} */
    const impl = ([n, p]) => {
        const type = virtualFnType(` ${n}`)(p)
        return [
            `${type} {`,
            [`unsafe { nanocom::CObject::from_object_unchecked(this) }.${n}(${call(p)})`],
            '}'
        ]
    }

    const flatMapImpl = flatMap(impl)

    /** @type {(i: types.Interface) => (name: string) => Text.Block} */
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
            trait({ pub: true, type: 'Ex', content: mapTraitFn(e) }),
            rustImpl({
                trait: 'Ex',
                type: 'Object',
                content: flatMapImplFn(e)
            }),
            traitImpl({
                pub: true,
                type: 'ClassEx',
                content: ['const VMT: Vmt = Vmt {',
                    [   'iunknown: nanocom::CObject::<Self>::IUNKNOWN,',
                        'interface: Interface {',
                            mapAssign(e),
                        '},',
                    ],
                    '};'
                ]
            }),
            traitImpl({
                type: 'PrivateClassEx',
                content: flatMapImpl(e)
            }),
            '}'
        ]
    }

    /** @type {(type: O.Entry<types.Definition>) => Text.Block} */
    const def = ([name, type]) => ('interface' in type ? interface_(type) : struct(type.struct))(name)

    return flat([['#![allow(non_snake_case)]'], flatMap(def)(entries(library))])
}
