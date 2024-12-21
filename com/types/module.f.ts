import * as O from '../../types/object/module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
import * as f from '../../types/function/module.f.mjs'
const { compose } = f
const { filter } = list
const { entries } = Object

export type Library = {readonly[k in string]: Definition}

export type Definition = Struct|Interface

export type Struct = {
    readonly struct: FieldArray
}

export type FieldArray = {readonly[k in string]: Type}

export type Field = O.Entry<Type>

export type Interface = {
    readonly interface: MethodArray
    readonly guid: string
}

type MethodArray = {readonly[k in string]: FieldArray}

export type Method = O.Entry<FieldArray>

export type Type = BaseType|Id|Pointer

type Id = readonly[string]

export type BaseType = |
   'u8'|
   'i8'|
   'u16'|
   'i16'|
   'u32'|
   'i32'|
   'u64'|
   'i64'|
   'usize'|
   'isize'|
   'f32'|
   'f64'|
   'bool'

type Pointer = readonly['*', Type]

const isParam
    : (kv: O.Entry<Type>) => boolean
    = ([name]) => name !== '_'

const filterParam = filter(isParam)

export const paramList
    : (fa: FieldArray) => list.List<Field>
    = compose(entries)(filterParam)

export const result
    : <T>(v: T) => (f: (type: Type) => T) => (fa: FieldArray) => T
    = v => f => fa => '_' in fa ? f(fa._) : v
