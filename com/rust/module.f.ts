/**
 * This module generates Rust code for COM interop from a high-level type library definition.
 *
 * The module provides functions to define structs, traits, and implementations in Rust,
 * specifically tailored for `nanocom` interpretation.
 */
import {
    paramList,
    type Definition,
    type Field,
    type FieldArray,
    type Interface,
    type Library,
    type Method,
    type Type
} from '../types/module.f.ts'
import type * as text from '../../text/module.f.ts'
import type * as O from '../../types/object/module.f.ts'
import { flat, map, flatMap, type Thunk } from '../../types/list/module.f.ts'
import { fn } from '../../types/function/module.f.ts'
import { join } from '../../types/string/module.f.ts'

const { entries } = Object

const rustField = (field: string): string => `pub ${field},`

const mapRustField = map(rustField)

const rustStruct = (b: Thunk<string>) => (name: string): text.Block =>
    [`#[repr(C)]`, `pub struct ${name} {`, mapRustField(b), `}`]

const commaJoin = join(', ')

const ref = (name: string): string =>
    `${name}::Ref`

const obj = (name: string): string => `&${name}::Object`

const self = ['&self']

const paramName = ([n]: Field): string => n

const callList = (p: FieldArray): Thunk<string> =>
    map(paramName)(paramList(p))

const call = (p: FieldArray): string =>
    commaJoin(callList(p))

const virtualCall = (p: FieldArray): string =>
    commaJoin(flat([['self'], callList(p)]))

const super_ = 'super::'

const assign = ([n]: Method): string => `${n}: Self::${n},`

const mapAssign = map(assign)

const this_ = ['this: &Object']

const rustType = (n: string): string =>
    `pub type ${n} = nanocom::${n}<Interface>;`

type OptionalProperty<T> = T|{}

type Where = {
    readonly where: readonly string[]
}

type WhereContent = OptionalProperty<Where> & {readonly content: text.Block}

const whereContent = (h: string) => (wh: WhereContent): text.Block => {
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
    readonly content: text.Block
}

const rustImpl = (i: Impl): text.Block => {
    const p = 'param' in i ? `<${i.param}>` : ''
    const header = `impl${p} ${i.trait} for ${i.type}`
    return whereContent(header)(i)
}

type Trait = {
    readonly pub?: true
    readonly type: string
    readonly where?: readonly string[]
    readonly content: text.Block
}

const comma: (s: string) => string = s => `${s},`

const mapComma = map(comma)

const trait = (t: Trait): text.Block => {
    const p = t.pub === true ? 'pub ' : ''
    const h = `${p}trait ${t.type}`
    return whereContent(h)(t)
}

const traitImpl = (t: Trait): text.Block => {
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
export const rust = (library: Library): text.Block => {

    const type = (p: string) => {
        const f = (o: (_: string) => string) => (t: Type): string => {
            if (typeof t === 'string') { return t }
            if (t.length === 2) { return `*const ${f(ref)(t[1])}` }
            const [id] = t
            const fullId = `${p}${id}`
            return 'interface' in library[id] ? o(fullId) : fullId
        }
        return f
    }

    const pf = (p: string) => (o: (_: string) => string) => ([name, t]: Field): string =>
        `${name}: ${type(p)(o)(t)}`

    const param = pf(super_)(obj)

    const mapParam = map(param)

    const mapField = map(pf('')(ref))

    const struct = fn(entries)
        .then(mapField)
        .then(rustStruct)
        .result

    const func = (first: readonly string[]) => (p: FieldArray) => {
        const resultStr = '_' in p ? ` -> ${type(super_)(ref)(p._)}` : ''
        const params = commaJoin(flat([first, mapParam(paramList(p))]))
        return `(${params})${resultStr}`
    }

    const virtualFnType = (n: string) => (p: FieldArray) =>
        `extern "system" fn${n}${func(this_)(p)}`

    const virtualFn = ([n, p]: Method) =>
        `${n}: unsafe ${virtualFnType('')(p)}`

    const mapVirtualFn = map(virtualFn)

    const headerFn = ([n, p]: Method) => `fn ${n}${func(self)(p)}`

    const traitFn = (m: Method) => `${headerFn(m)};`

    const mapTraitFn = map(traitFn)

    const implFn = (m: Method): text.Block => {
        const [n, p] = m
        return [
            `${headerFn(m)} {`,
            [`unsafe { (self.interface().${n})(${virtualCall(p)}) }`],
            '}'
        ]
    }

    const flatMapImplFn = flatMap(implFn)

    const impl = ([n, p]: Method): text.Block => {
        const type = virtualFnType(` ${n}`)(p)
        return [
            `${type} {`,
            [`unsafe { nanocom::CObject::from_object_unchecked(this) }.${n}(${call(p)})`],
            '}'
        ]
    }

    const flatMapImpl = flatMap(impl)

    const interface_ = ({ interface: i, guid }: Interface) => (name: string): text.Block => {

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

    const def = ([name, type]: O.Entry<Definition>): text.Block =>
        ('interface' in type ? interface_(type) : struct(type.struct))(name)

    return flat([['#![allow(non_snake_case)]'], flatMap(def)(entries(library))])
}
