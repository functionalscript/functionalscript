/**
 * This module generates Rust code for COM interop from a high-level type library definition.
 *
 * The module provides functions to define structs, traits, and implementations in Rust,
 * specifically tailored for `nanocom` interoperation.
 */
import { paramList, type Definition, type Field, type FieldArray, type Interface, type Library, type Method, type Type } from '../types/module.f.ts'
import * as Text from '../../text/module.f.ts'
import * as O from '../../types/object/module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { flat, map, flatMap } = list
const { entries } = Object
import * as func from '../../types/function/module.f.ts'
const { fn } = func
import * as string from '../../types/string/module.f.ts'
const { join } = string

const rustField
    : (field: string) => string
    = field => `pub ${field},`

const mapRustField = map(rustField)

const rustStruct
    : (b: list.Thunk<string>) => (name: string) => Text.Block
    = b => name => [`#[repr(C)]`, `pub struct ${name} {`, mapRustField(b), `}`]

const commaJoin = join(', ')

const ref
    : (name: string) => string
    = name => `${name}::Ref`

const obj
    : (name: string) => string
    = name => `&${name}::Object`

const self = ['&self']

const paramName
: (p: Field) => string
= ([n]) => n

const callList
: (p: FieldArray) => list.Thunk<string>
= p => map(paramName)(paramList(p))

const call
: (p: FieldArray) => string
= p => commaJoin(callList(p))

const virtualCall
: (p: FieldArray) => string
= p => commaJoin(flat([['self'], callList(p)]))

const super_ = 'super::'

const assign
: (m: Method) => string
= ([n]) => `${n}: Self::${n},`

const mapAssign = map(assign)

const this_ = ['this: &Object']

const rustType
: (n: string) => string
= n => `pub type ${n} = nanocom::${n}<Interface>;`

type OptionalProperty<T> = T|{}

type Where = {readonly where: readonly string[]}

type WhereContent = OptionalProperty<Where> & {readonly content: Text.Block}

const whereContent
: (h: string) => (wh: WhereContent) => Text.Block
= h => wh => {
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

type Impl = {
    readonly param?: string
    readonly trait: string
    readonly type: string
    readonly where?: readonly string[]
    readonly content: Text.Block
}

const rustImpl
: (impl: Impl) => Text.Block
= i => {
    const p = 'param' in i ? `<${i.param}>` : ''
    const header = `impl${p} ${i.trait} for ${i.type}`
    return whereContent(header)(i)
}

type Trait = {
    readonly pub?: true
    readonly type: string
    readonly where?: readonly string[]
    readonly content: Text.Block
}

const comma: (s: string) => string = s => `${s},`

const mapComma = map(comma)

const trait
: (t: Trait) => Text.Block
= t => {
    const p = t.pub === true ? 'pub ' : ''
    const h = `${p}trait ${t.type}`
    return whereContent(h)(t)
}

const traitImpl
: (t: Trait) => Text.Block
= t => {
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
 * @param library - The library of type definitions to generate Rust code for.
 * @returns A block of Rust code representing the library.
 */
export const rust = (library: Library): Text.Block => {

    const type
    : (p: string) => (o: (_: string) => string) => (t: Type) => string
    = p => {
        const f
        : (o: (_: string) => string) => (t: Type) => string
        = o => t => {
            if (typeof t === 'string') { return t }
            if (t.length === 2) { return `*const ${f(ref)(t[1])}` }
            const [id] = t
            const fullId = `${p}${id}`
            return 'interface' in library[id] ? o(fullId) : fullId
        }
        return f
    }

    const pf
    : (p: string) => (o: (_: string) => string) => (f: Field) => string
    = p => o => ([name, t]) => `${name}: ${type(p)(o)(t)}`

    const param = pf(super_)(obj)

    const mapParam = map(param)

    const mapField = map(pf('')(ref))

    const struct
    : (fa: FieldArray) => (name: string) => Text.Block
    = fn(entries)
        .then(mapField)
        .then(rustStruct)
        .result

    const func
    : (first: readonly string[]) => (p: FieldArray) => string
    = first => p => {
        const resultStr = '_' in p ? ` -> ${type(super_)(ref)(p._)}` : ''
        const params = commaJoin(flat([first, mapParam(paramList(p))]))
        return `(${params})${resultStr}`
    }

    const virtualFnType
    : (n: string) => (p: FieldArray) => string
    = n => p => `extern "system" fn${n}${func(this_)(p)}`

    const virtualFn
    : (m: Method) => string
    = ([n, p]) => `${n}: unsafe ${virtualFnType('')(p)}`

    const mapVirtualFn = map(virtualFn)

    const headerFn
    : (m: Method) => string
    = ([n, p]) => `fn ${n}${func(self)(p)}`

    const traitFn
    : (m: Method) => string
    = m => `${headerFn(m)};`

    const mapTraitFn = map(traitFn)

    const implFn
    : (m: Method) => Text.Block
    = m => {
        const [n, p] = m
        return [
            `${headerFn(m)} {`,
            [`unsafe { (self.interface().${n})(${virtualCall(p)}) }`],
            '}'
        ]
    }

    const flatMapImplFn = flatMap(implFn)

    const impl
    : (m: Method) => Text.Block
    = ([n, p]) => {
        const type = virtualFnType(` ${n}`)(p)
        return [
            `${type} {`,
            [`unsafe { nanocom::CObject::from_object_unchecked(this) }.${n}(${call(p)})`],
            '}'
        ]
    }

    const flatMapImpl = flatMap(impl)

    const interface_
    : (i: Interface) => (name: string) => Text.Block
    = ({ interface: i, guid }) => name => {

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

    const def
    : (type: O.Entry<Definition>) => Text.Block
    = ([name, type]) => ('interface' in type ? interface_(type) : struct(type.struct))(name)

    return flat([['#![allow(non_snake_case)]'], flatMap(def)(entries(library))])
}
