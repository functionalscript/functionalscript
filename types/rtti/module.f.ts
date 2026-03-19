import { todo } from '../../dev/module.f.ts'
import { ok, error, type Result as CommonResult } from "../result/module.f.ts"

const includes = <I, T extends readonly I[]>(a: T) => (v: I): v is T[number] => a.includes(v)

export type Result<T extends Type> = CommonResult<Ts<T>, string>

const objectTypeList = ['null', 'array', 'record'] as const

const isObjectType = includes(objectTypeList)

export type NonObjectType =
    | 'undefined'
    | 'boolean'
    | 'string'
    | 'number'
    | 'bigint'
    | 'function'

export type ObjectType = typeof objectTypeList[number]

export type BaseType =
    | NonObjectType
    | ObjectType

export type RecordType = object & {
    readonly[K in string]: Type
}

export type LazyType = () => Type

export type Type = BaseType | RecordType | LazyType

type NonObjectTs<T extends NonObjectType> =
    T extends 'undefined' ? undefined :
    T extends 'boolean' ? boolean :
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'bigint' ? bigint :
    T extends 'function' ? Function :
    never

type ObjectTs<T extends ObjectType> =
    T extends 'null' ? null :
    T extends 'array' ? readonly unknown[] :
    T extends 'record' ? Record<string, unknown> :
    never

type BaseTs<T extends BaseType> =
    T extends NonObjectType ? NonObjectTs<T> :
    T extends ObjectType ? ObjectTs<T> :
    never

/**
 * Converts to TypeScript type.
 */
export type Ts<T extends Type> =
    T extends BaseType ? BaseTs<T> :
    T extends LazyType ? Ts<ReturnType<T>> :
    T extends RecordType ? object & { readonly [K in keyof T]: Ts<T[K]> } :
    never

const nonObjectValidate = <T extends NonObjectType>(rtti: T) => (value: unknown): Result<T> =>
    typeof value === rtti ? ok(value as Ts<T>) : error(rtti)

const isNull = (v: unknown): v is null => v === null

const isArray = (v: unknown): v is readonly unknown[] => v instanceof Array

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && !isNull(v) && !isArray(v)

const wrap = <T extends ObjectType>(f: (value: unknown) => value is Ts<T>) => (value: unknown): Result<T> =>
    f(value) ? ok(value) : error('unexpected value')

const objectSwitch: { readonly[K in ObjectType]: (value: unknown) => Result<K> } = {
    null: wrap(isNull),
    array: wrap(isArray),
    record: wrap(isRecord),
}

const objectValidate = <T extends ObjectType>(rtti: T): (value: unknown) => Result<T> =>
    objectSwitch[rtti]

const baseValidate = <T extends BaseType>(rtti: T): (value: unknown) => Result<T> =>
    isObjectType(rtti) ? objectValidate(rtti) : nonObjectValidate(rtti as T & NonObjectType)

export const validate: <T extends Type>(rtti: T) => (value: unknown) => Result<T> = rtti => {
    switch (typeof rtti) {
        case 'function':
            return validate(rtti()) as any // TS goes into infinte loop
        case 'string':
            return baseValidate(rtti)
        case 'object':
            rtti
    }
}
