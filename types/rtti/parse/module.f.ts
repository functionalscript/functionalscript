/**
 * Runtime deserialization of unknown values against RTTI schemas.
 *
 * The main entry point is `parse(rtti)`, which takes a schema `Type` and returns
 * a `Parse<T>` function. When called with an unknown value, it returns a `Result`
 * that is either `['ok', newValue]` or `['error', { path, message }]`.
 *
 * Unlike `validate`, which checks an existing value in-place and returns it
 * unchanged on success, `parse` always returns a freshly constructed value that
 * contains only the fields/elements declared by the schema. This makes both
 * structs and tuples effectively closed at runtime, matching the TypeScript
 * type produced by `Ts<T>`:
 *
 * - Tuples: the result has exactly the schema's length; extra elements are dropped.
 * - Structs: the result contains only the schema's keys; extra properties are dropped.
 * - Arrays/records: every element/value is itself parsed, so a fresh container is
 *   always returned even if the inner type is a primitive.
 *
 * This also provides forward compatibility with extended serialization formats:
 * a schema-based parser keeps working when newer versions of the format add
 * extra fields or tuple elements.
 *
 * Error path semantics, error type, and primitive/const-primitive checks are
 * shared with `validate`; only container construction differs.
 *
 * @module
 */
import type { Unknown } from '../../../djs/module.f.ts'
import {
    type Const,
    type ConstObject,
    type Info1,
    type Struct,
    type Tuple,
    type Type,
} from '../module.f.ts'
import { ok, type Error, type Result as CommonResult } from '../../result/module.f.ts'
import {
    constPrimitiveValidate,
    prependPath,
    primitive0Validate,
    verror,
    type Result as ValidateResult,
    type Validate,
    type ValidationError,
} from '../validate/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject } from '../../object/module.f.ts'
import { find, map as listMap } from '../../list/module.f.ts'

export type { Path, ValidationError } from '../validate/module.f.ts'

/** Parse result: either the freshly constructed typed value or a `ValidationError`. */
export type Result<T extends Type> = ValidateResult<T>

/** A function that parses an unknown value into the schema `T`. */
export type Parse<T extends Type> = Validate<T>

type ItemResult = CommonResult<Unknown, ValidationError>

const indexedFirstError = (results: readonly ItemResult[]): readonly[number, Error<ValidationError>] | null => {
    // TODO: findIndex breaks type inference,
    //       we should replace it with something else.
    const i = results.findIndex(r => r[0] === 'error')
    return i < 0 ? null : [i, results[i] as Error<ValidationError>]
}

const keyedFirstError = (
    results: readonly (readonly[string, ItemResult])[],
): readonly[string, Error<ValidationError>] | null => {
    const e = results.find(([, r]) => r[0] === 'error')
    return e === undefined ? null : [e[0], e[1] as Error<ValidationError>]
}

const arrayParse =
    <I extends Type>(item: I): Parse<Info1<'array', I>> => value =>
{
    if (!commonIsArray(value)) {
        return verror('unexpected value')
    }
    if (value.length === 0) {
        return ok([] as any)
    }
    // Note: we shouldn't instantiate `itemParse` until we know the array is non-empty.
    //       Otherwise, we can get infinite recursion on empty arrays for recursive schemas.
    const itemParse = parse(item) as (v: Unknown) => ItemResult
    const results = value.map(itemParse)
    const err = indexedFirstError(results)
    return (err === null
        ? ok(results.map(r => r[1]))
        : prependPath(String(err[0]), err[1])) as any
}

const recordParse =
    <I extends Type>(item: I): Parse<Info1<'record', I>> => value =>
{
    if (!commonIsObject(value)) {
        return verror('unexpected value')
    }
    const entries = Object.entries(value)
    if (entries.length === 0) {
        return ok({} as any)
    }
    const itemParse = parse(item) as (v: Unknown) => ItemResult
    const results = entries.map(([k, v]) => [k, itemParse(v)] as const)
    const err = keyedFirstError(results)
    return (err === null
        ? ok(Object.fromEntries(results.map(([k, r]) => [k, r[1]])))
        : prependPath(err[0], err[1])) as any
}

const tupleParse = <T extends Tuple>(rtti: T): Parse<T> => value => {
    if (!commonIsArray(value)) {
        return verror('unexpected value')
    }
    const results = rtti.map((t, i) => (parse(t) as any)(value[i]) as ItemResult)
    const err = indexedFirstError(results)
    return (err === null
        ? ok(results.map(r => r[1]))
        : prependPath(String(err[0]), err[1])) as any
}

const structParse = <T extends Struct>(rtti: T): Parse<T> => value => {
    if (!commonIsObject(value)) {
        return verror('unexpected value')
    }
    const results = Object.entries(rtti).map(
        ([k, t]) => [k, (parse(t) as any)(value[k]) as ItemResult] as const,
    )
    const err = keyedFirstError(results)
    return (err === null
        ? ok(Object.fromEntries(results.map(([k, r]) => [k, r[1]])))
        : prependPath(err[0], err[1])) as any
}

const constObjectParse = <T extends ConstObject>(rtti: T): Parse<T> =>
    commonIsArray(rtti)
        ? tupleParse(rtti) as any
        : structParse(rtti) as any

const constParse = <T extends Const>(rtti: T): Parse<T> =>
    typeof rtti === 'object' && rtti !== null
        ? constObjectParse(rtti) as any
        : constPrimitiveValidate(rtti) as any

const findFirst = find
    (verror('no match'))
    ((k: any) => k[0] === 'ok')

const orParse = <T extends readonly Type[]>(rtti: T): Parse<() => readonly['or', ...T]> =>
    value => findFirst(listMap(t => (parse as any)(t)(value))(rtti))

/**
 * Creates a parser function for the given RTTI schema.
 *
 * The returned function takes an unknown value and returns either
 * `['ok', newValue]` containing a freshly constructed value matching the schema,
 * or `['error', { path, message }]` describing the failure location.
 *
 * @param rtti - A schema `Type`: a `Thunk` for tag-based schemas, or a `Const`
 *   (primitive literal, tuple, or struct) for exact-value schemas.
 * @returns A `Parse<T>` function.
 *
 * @example
 * ```ts
 * const p = parse(array(number))
 * p([1, 2, 3])         // ['ok', [1, 2, 3]]   (a new array)
 * p([1, 'two'])        // ['error', { path: ['1'], message: 'unexpected value' }]
 *
 * // tuples are closed: extra elements are dropped
 * parse([number, number] as const)([1, 2, 3]) // ['ok', [1, 2]]
 *
 * // structs drop undeclared keys
 * parse({ a: number } as const)({ a: 1, b: 2 }) // ['ok', { a: 1 }]
 * ```
 */
export const parse = <T extends Type>(rtti: T): Parse<T> => {
    if (typeof rtti === 'function') {
        const [tag, ...value] = rtti()
        switch (tag) {
            case 'const': return constParse(value[0] as Const) as any
            case 'array': return arrayParse(value[0]) as any
            case 'record': return recordParse(value[0]) as any
            case 'unknown': return ok as any
            case 'or': return orParse(value) as any
        }
        return primitive0Validate(tag) as any
    }
    return constParse(rtti) as any
}
