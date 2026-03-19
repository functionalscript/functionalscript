/**
 * It's similar to `typeof` but with one exception:
 * `object` means it's not `null` and not `array`.
 */
export type BaseType =
    | 'undefined'
    | 'boolean'
    | 'string'
    | 'number'
    | 'bigint'
    | 'null'
    | 'array'
    | 'object'
    | 'function'

export type ObjectType = {
    readonly[K in string]: Type
}

export type LazyType = () => Type

export type Type = BaseType | ObjectType | LazyType

type BaseTs<T extends BaseType> =
    T extends 'undefined' ? undefined :
    T extends 'boolean' ? boolean :
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'bigint' ? bigint :
    T extends 'null' ? null :
    T extends 'array' ? readonly unknown[] :
    T extends 'object' ? object :
    T extends 'function' ? Function :
    never

/**
 * Converts to TypeScript type.
 */
export type Ts<T extends Type> =
    T extends BaseType ? BaseTs<T> :
    T extends LazyType ? Ts<ReturnType<T>> :
    T extends ObjectType ? { readonly [K in keyof T]: Ts<T[K]> } :
    never
