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

export type Lazy = () => Info

export type Type =
    | Const
    | Lazy

const one = <T extends Tag>(tag: T) => [tag] as const

export type String = () => One<'string'>

export const boolean = one('boolean')

export const number = one('number')

export const string = one('string')

export const bigint = one('bigint')

export const record = one('record')

export const array = one('array')

export type Unknown = Primitive | RecordTs | ArrayTs

export type RecordTs = object & { readonly[K in string]: Unknown }

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

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

type Assert<T extends true> = T

type _0 = Assert<Equal<
    Ts<readonly[
        number,
        4,
        String,
        null,
        'hello!',
        () => ['const', 7n],
        () => ['array'],
        () => ['record'],
        {
            readonly a: () => readonly['string'],
            b: bigint
        },
        () => ['const', readonly[String]]
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
        readonly[string]
    ]
>>
