type Primitive = undefined | null | boolean | number | string | bigint

type Const = Primitive | Struct | Tuple

type Struct = object & { readonly[K in string]: Type }

type Tuple = readonly Type[]

type Tag =
    | 'boolean'
    | 'number'
    | 'string'
    | 'bigint'
    | 'record'
    | 'array'

type One<T extends Tag> = readonly[T]

export type Info =
    | One<Tag>
    | readonly['const', Const]

export type Thunk = () => Info

export type Type =
    | Const
    | Thunk

type Basic<T extends Tag> = () => One<T>

const basic = <T extends Tag>(tag: T): Basic<T> => () => [tag]

export type Boolean = Basic<'boolean'>

export const boolean: Boolean = basic('boolean')

export type Number = Basic<'number'>

export const number: Number = basic('number')

export type String = Basic<'string'>

export const string: String = basic('string')

export type Bigint = Basic<'bigint'>

export const bigint: Bigint = basic('bigint')

export type Record = Basic<'record'>

export const record = basic('record')

export type Array = Basic<'array'>

export const array = basic('array')

export type Unknown = Primitive | RecordTs | ArrayTs

export type RecordTs = { readonly[K in string]: Unknown }

export type ArrayTs = readonly Unknown[]

export type OneTs<T extends Tag> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'bigint' ? bigint :
    T extends 'record' ? RecordTs :
    T extends 'array' ? ArrayTs :
    never

export type ConstTs<T extends Const> =
    T extends Primitive ? T :
    T extends Tuple ? TupleTs<T> :
    T extends Struct ? StructTs<T> :
    never

export type InfoTs<T extends Info> =
    T extends readonly['const', infer C extends Const] ? ConstTs<C> :
    T extends readonly[infer G extends Tag] ? OneTs<G> :
    never

export type TupleTs<T extends Tuple> = { readonly[K in keyof T]: Ts<T[K]> }

export type StructTs<T extends Struct> = { readonly[K in keyof T]: Ts<T[K]> }

export type Ts<T extends Type> =
    T extends () => (infer I extends Info) ? InfoTs<I> :
    T extends Const ? ConstTs<T> :
    never

import type { Equal, Assert } from "../ts/module.f.ts"

type _0 = Assert<Equal<
    Ts<readonly[
        number,
        4,
        String,
        null,
        'hello!',
        () => ['const', 7n],
        typeof array,
        () => ['record'],
        {
            readonly a: typeof string,
            b: bigint
        },
        () => ['const', readonly[String, 5n]]
    ]>,
    readonly[
        number,
        4,
        string,
        null,
        'hello!',
        7n,
        readonly Unknown[],
        RecordTs,
        {
            readonly a: string,
            readonly b: bigint
        },
        readonly[string, 5n]
    ]
>>
