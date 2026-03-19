import { todo } from '../../dev/module.f.ts'
import { ok, error, type Result } from "../result/module.f.ts"

export type BaseType =
    | 'undefined'
    | 'boolean'
    | 'string'
    | 'number'
    | 'bigint'
    | 'null'
    | 'array'
    | 'record'
    | 'function'

export type RecordType = {
    readonly[K in string]: Type
}

export type LazyType = () => Type

export type Type = BaseType | RecordType | LazyType

type BaseTs<T extends BaseType> =
    T extends 'undefined' ? undefined :
    T extends 'boolean' ? boolean :
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends 'bigint' ? bigint :
    T extends 'null' ? null :
    T extends 'array' ? readonly unknown[] :
    T extends 'record' ? Record<string, unknown> :
    T extends 'function' ? Function :
    never

/**
 * Converts to TypeScript type.
 */
export type Ts<T extends Type> =
    T extends BaseType ? BaseTs<T> :
    T extends LazyType ? Ts<ReturnType<T>> :
    T extends RecordType ? { readonly [K in keyof T]: Ts<T[K]> } :
    never

const baseValidate = <T extends BaseType>(rtti: T) => (value: unknown): Result<BaseTs<T>, string> => {

}

export const validate: <T extends Type>(rtti: T) => (value: unknown) => Result<Ts<T>, string> = rtti => {
    switch (typeof rtti) {
        case 'function':
            return validate(rtti()) as any // TS goes into infinte loop
        case 'string':
            return baseValidate(rtti)
        default:
            return todo()
    }
}
