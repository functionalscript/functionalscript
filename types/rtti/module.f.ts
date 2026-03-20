import type { Equal, Assert } from '../ts/module.f.ts'
import type {
    Primitive,
    Unknown as DjsUnknown,
    Object as DjsObject,
    Array as DjsArray
} from '../../djs/module.f.ts'

type Const = Primitive | Struct | Tuple

type Struct = { readonly[K in string]: Type }

type Tuple = readonly Type[]

type Tag =
    | 'boolean'
    | 'number'
    | 'string'
    | 'bigint'
    | 'record'
    | 'array'
    | 'unknown'

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

export type Unknown = Basic<'unknown'>

export const unknown: Unknown = basic('unknown')

export type UnknownRecord = Basic<'record'>

export const unknownRecord: UnknownRecord = basic('record')

export type UnknownArray = Basic<'array'>

export const unknownArray: UnknownArray = basic('array')

export type OneTs<T extends Tag> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'bigint' ? bigint :
    T extends 'unknown' ? DjsUnknown :
    T extends 'record' ? DjsObject :
    T extends 'array' ? DjsArray :
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

type _0 = Assert<Equal<
    Ts<readonly[
        number,
        4,
        String,
        null,
        'hello!',
        () => ['const', 7n],
        typeof unknown,
        typeof unknownArray,
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
        DjsUnknown,
        readonly DjsUnknown[],
        DjsObject,
        {
            readonly a: string,
            readonly b: bigint
        },
        readonly[string, 5n]
    ]
>>
