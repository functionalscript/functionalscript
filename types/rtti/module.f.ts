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

/**
 * Converts to TypeScript type.
 */
export type Ts<T extends Type> =
