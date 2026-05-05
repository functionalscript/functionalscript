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
 * The error path semantics match `validate`: each step is the string property
 * name (struct/record) or the stringified index (tuple/array); the path is empty
 * when the failure is at the root.
 *
 * @module
 */
import type { Unknown } from '../../../djs/module.f.ts'
import {
    type Const,
    type ConstObject,
    type Info0,
    type Info1,
    type Primitive0,
    type Struct,
    type Tuple,
    type Type,
} from '../module.f.ts'
import { error, ok, type Error, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject } from '../../object/module.f.ts'
import type { Primitive } from '../../../djs/module.f.ts'

/** A path to a sub-value within the parsed structure. Each step is an object key or stringified array index. */
export type Path = readonly string[]

/** Detailed parse failure: the offending `path` plus a short `message`. */
export type ParseError = {
    readonly path: Path
    readonly message: string
}

/** Parse result: either the freshly constructed typed value or a `ParseError`. */
export type Result<T extends Type> = CommonResult<Ts<T>, ParseError>

/** A function that parses an unknown value into the schema `T`. */
export type Parse<T extends Type> = (value: Unknown) => Result<T>

const perror = (message: string): Error<ParseError> =>
    error({ path: [], message })

const prependPath = (key: string, r: Error<ParseError>): Error<ParseError> =>
    error({ path: [key, ...r[1].path], message: r[1].message })

const arrayParse =
    <I extends Type>(item: I): Parse<Info1<'array', I>> => value =>
{
    if (!commonIsArray(value)) {
        return perror('unexpected value') as any
    }
    if (value.length === 0) {
        return ok([]) as any
    }
    // Note: we shouldn't instantiate `itemParse` until we know the array is non-empty.
    //       Otherwise, we can get infinite recursion on empty arrays for recursive schemas.
    const itemParse = parse(item) as (v: Unknown) => CommonResult<Unknown, ParseError>
    const out: Unknown[] = []
    for (let i = 0; i < value.length; i++) {
        const r = itemParse(value[i])
        if (r[0] === 'error') {
            return prependPath(String(i), r) as any
        }
        out.push(r[1])
    }
    return ok(out) as any
}

const recordParse =
    <I extends Type>(item: I): Parse<Info1<'record', I>> => value =>
{
    if (!commonIsObject(value)) {
        return perror('unexpected value') as any
    }
    const entries = Object.entries(value)
    if (entries.length === 0) {
        return ok({}) as any
    }
    const itemParse = parse(item) as (v: Unknown) => CommonResult<Unknown, ParseError>
    const out: { [k: string]: Unknown } = {}
    for (const [k, v] of entries) {
        const r = itemParse(v)
        if (r[0] === 'error') {
            return prependPath(k, r) as any
        }
        out[k] = r[1]
    }
    return ok(out) as any
}

/** Parses a `Tag0` primitive schema using `typeof`. */
const primitive0Parse = <K extends Primitive0, T extends Info0<K>>(tag: K): Parse<T> =>
    value => typeof value === tag ? ok(value) as any : perror('unexpected value') as any

const tupleParse = <T extends Tuple>(rtti: T): Parse<T> => value => {
    if (!commonIsArray(value)) {
        return perror('unexpected value') as any
    }
    const out: Unknown[] = []
    for (let i = 0; i < rtti.length; i++) {
        const r = (parse(rtti[i]) as any)(value[i]) as CommonResult<Unknown, ParseError>
        if (r[0] === 'error') {
            return prependPath(String(i), r) as any
        }
        out.push(r[1])
    }
    return ok(out) as any
}

const structParse = <T extends Struct>(rtti: T): Parse<T> => value => {
    if (!commonIsObject(value)) {
        return perror('unexpected value') as any
    }
    const out: { [k: string]: Unknown } = {}
    for (const [k, v] of Object.entries(rtti)) {
        const r = (parse(v) as any)(value[k]) as CommonResult<Unknown, ParseError>
        if (r[0] === 'error') {
            return prependPath(k, r) as any
        }
        out[k] = r[1]
    }
    return ok(out) as any
}

const constObjectParse = <T extends ConstObject>(rtti: T): Parse<T> =>
    commonIsArray(rtti)
        ? tupleParse(rtti) as any
        : structParse(rtti) as any

/** Parses a primitive `Const` schema using strict equality (`===`). */
const constPrimitiveParse = <T extends Primitive>(rtti: T): Parse<T> =>
    value => rtti === value
        ? ok(value) as any
        : perror('unexpected value') as any

const constParse = <T extends Const>(rtti: T): Parse<T> =>
    typeof rtti === 'object' && rtti !== null
        ? constObjectParse(rtti) as any
        : constPrimitiveParse(rtti) as any

const orParse = <T extends readonly Type[]>(rtti: T): Parse<() => readonly['or', ...T]> => {
    const all = rtti.map(r => parse(r))
    return value => {
        for (const i of all) {
            const r = (i as any)(value)
            if (r[0] === 'ok') {
                return r
            }
        }
        return perror('no match') as any
    }
}

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
        return primitive0Parse(tag) as any
    }
    return constParse(rtti) as any
}
