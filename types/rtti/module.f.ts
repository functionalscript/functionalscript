import { includes } from "../array/module.f.ts"
import { ok, error, type Result as CommonResult } from "../result/module.f.ts"

export type Result<T extends Type> = CommonResult<Ts<T>, string>

// object

const objectTypeList = ['null', 'array', 'record'] as const

const isObjectType = includes(objectTypeList)

// non object

export type NonObjectType =
    | 'undefined'
    | 'boolean'
    | 'string'
    | 'number'
    | 'bigint'
    | 'function'

export type ObjectType = typeof objectTypeList[number]

// base: object or non object

export type BaseType =
    | NonObjectType
    | ObjectType

export type RecordType = object & {
    readonly[K in string]: Type
}

export type LazyType = () => NonLazyType

export type NonLazyType = BaseType | RecordType

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
    T extends RecordType ? object & { readonly [K in keyof T]: Ts<T[K]> } :
    never

/**
 * Converts to TypeScript type.
 */
export type Ts<T extends Type> = NonLazyTs<ToNonLazy<T>>

export type Validate<T extends Type> = (value: unknown) => Result<T>

const nonObjectValidate = <T extends NonObjectType>(rtti: T) => (value: unknown): Result<T> =>
    typeof value === rtti ? ok(value as Ts<T>) : error(rtti)

const isNull = (v: unknown): v is null =>
    v === null

const isArray = (v: unknown): v is readonly unknown[] =>
    v instanceof Array

const isRecord = (v: unknown): v is RecordTs =>
    typeof v === 'object' && !isNull(v) && !isArray(v)

const wrap = <T extends ObjectType>(f: (value: unknown) => value is Ts<T>) => (value: unknown): Result<T> =>
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

const recordValidate: <T extends RecordType>(rtti: T) => Validate<T> = rtti => value => {
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

export const nonLazyValidate = <T extends NonLazyType>(rtti: T): Validate<T> => {
    switch (typeof rtti) {
        case 'string':
            return baseValidate(rtti)
        case 'object':
            return recordValidate(rtti)
    }
}

export type ToNonLazy<T extends Type> = T extends () => infer R ? R : T

export const nonLazy = <T extends Type>(rtti: T): ToNonLazy<T> =>
    (typeof rtti === 'function' ? rtti() : rtti) as ToNonLazy<T>

export const validate = <T extends Type>(rtti: T): Validate<T> =>
    nonLazyValidate(nonLazy(rtti) as T & NonLazyType)
