/**
 * Runtime type information (RTTI) for validating unknown values against typed schemas.
 *
 * A `Type` is either a `BaseType` string tag (e.g. `'string'`, `'number'`, `'record'`),
 * a `StructType` object mapping field names to nested `Type`s, or a `LazyType` thunk
 * for recursive definitions. Use {@link validate} to produce a type-safe validator.
 *
 * @module
 */
import { includes } from "../array/module.f.ts"
import { ok, error, type Result as CommonResult } from "../result/module.f.ts"

/** Validation result: either the typed value or an error message. */
export type Result<T extends Type> = CommonResult<Ts<T>, string>

// object

const objectTypeList = ['null', 'array', 'record'] as const

const isObjectType = includes(objectTypeList)

// non object

/** String tags for non-object primitive types. */
export type NonObjectType =
    | 'undefined'
    | 'boolean'
    | 'string'
    | 'number'
    | 'bigint'
    | 'function'

/** String tags for object types: `'null'`, `'array'`, `'record'`. */
export type ObjectType = typeof objectTypeList[number]

/** Union of all base type string tags. */
export type BaseType =
    | NonObjectType
    | ObjectType

/**
 * A struct schema: an object whose keys are field names and values are nested `Type`s.
 * Used to validate plain objects with specific typed fields.
 */
export type StructType = object & {
    readonly[K in string]: Type
}

/** A thunk returning a `NonLazyType`, used for recursive type definitions. */
export type LazyType = () => NonLazyType

/** A `Type` that is not wrapped in a thunk. */
export type NonLazyType = BaseType | StructType

/** Any RTTI type: a base tag string, a struct schema object, or a lazy thunk. */
export type Type = NonLazyType | LazyType

type NonObjectTs<T extends NonObjectType> =
    T extends 'undefined' ? undefined :
    T extends 'boolean' ? boolean :
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'bigint' ? bigint :
    T extends 'function' ? Function :
    never

type ArrayTs = readonly unknown[]

type RecordTs = object & { readonly[K in string]: unknown }

type ObjectTs<T extends ObjectType> =
    T extends 'null' ? null :
    T extends 'array' ? ArrayTs :
    T extends 'record' ? RecordTs :
    never

type BaseTs<T extends BaseType> =
    T extends NonObjectType ? NonObjectTs<T> :
    T extends ObjectType ? ObjectTs<T> :
    never

type NonLazyTs<T extends NonLazyType> =
    T extends BaseType ? BaseTs<T> :
    T extends StructType ? object & { readonly [K in keyof T]: Ts<T[K]> } :
    never

/**
 * Converts an RTTI `Type` to its corresponding TypeScript type.
 * @example `Ts<'string'>` → `string`, `Ts<{ x: 'number' }>` → `{ readonly x: number }`
 */
export type Ts<T extends Type> = NonLazyTs<ToNonLazy<T>>

/** A function that validates an unknown value against type `T`. */
export type Validate<T extends Type> = (value: unknown) => Result<T>

const nonObjectValidate = <T extends NonObjectType>(rtti: T): Validate<T> => value =>
    typeof value === rtti ? ok(value as Ts<T>) : error(rtti)

const isNull = (v: unknown): v is null =>
    v === null

const isArray = (v: unknown): v is ArrayTs =>
    v instanceof Array

const isRecord = (v: unknown): v is RecordTs =>
    typeof v === 'object' && !isNull(v) && !isArray(v)

const wrap = <T extends ObjectType>(f: (value: unknown) => value is Ts<T>): Validate<T> => value =>
    f(value) ? ok(value) : error(`unexpected value: ${value}`)

const objectSwitch: { readonly[K in ObjectType]: Validate<K> } = {
    null: wrap(isNull),
    array: wrap(isArray),
    record: wrap(isRecord),
}

const objectValidate = <T extends ObjectType>(rtti: T) =>
    objectSwitch[rtti]

const baseValidate = <T extends BaseType>(rtti: T): Validate<T> =>
    isObjectType(rtti) ? objectValidate(rtti) : nonObjectValidate(rtti as T & NonObjectType)

const recordValidate = <T extends StructType>(rtti: T): Validate<T> => value => {
    if (!isRecord(value)) {
        return error('record is expected')
    }
    for (const [k, t] of Object.entries(rtti)) {
        const r = validate(t)(value[k])
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value as Ts<typeof rtti> & RecordTs)
}

const nonLazyValidate = <T extends NonLazyType>(rtti: T): Validate<T> => {
    switch (typeof rtti) {
        case 'string':
            return baseValidate(rtti)
        case 'object':
            return recordValidate(rtti)
    }
}

type ToNonLazy<T extends Type> = T extends () => infer R ? R : T

const nonLazy = <T extends Type>(rtti: T): T & ToNonLazy<T> =>
    (typeof rtti === 'function' ? rtti() : rtti) as T & ToNonLazy<T>

/**
 * Creates a validator function for the given RTTI schema.
 * @param rtti - A base type tag, struct schema, or lazy thunk.
 * @returns A function `(value: unknown) => Result<T>`.
 */
export const validate = <T extends Type>(rtti: T): Validate<T> =>
    nonLazyValidate(nonLazy(rtti))
