/**
 * Runtime validation of unknown values against RTTI schemas.
 *
 * The main entry point is `validate(rtti)`, which takes a schema `Type` and returns
 * a `Validate<T>` function. When called with an unknown value, it returns a `Result`
 * that is either `['ok', typedValue]` or `['error', message]`.
 *
 * ## Dispatch strategy
 *
 * - **`Thunk`** schemas are evaluated lazily: the thunk is called once to obtain an
 *   `Info` descriptor, then dispatched by tag:
 *   - `'const'` — delegates to `constValidate`
 *   - `'unknown'` — always succeeds (any DJS value is valid)
 *   - `Tag1` (`'array'`, `'record'`) — delegates to `containerValidate`
 *   - `Tag0` (`'boolean'`, `'number'`, `'string'`, `'bigint'`) — uses `typeof` check
 * - **`Const`** schemas (primitives, tuples, structs) validate by exact equality or
 *   recursive field/element checking.
 *
 * ## Recursion safety
 *
 * For `array` and `record` schemas, the inner item validator is instantiated lazily —
 * only after confirming the container is non-empty. This prevents infinite recursion
 * when validating recursive schemas like `const list = () => ['array', list]`.
 *
 * @module
 */
import type { Unknown } from '../../../djs/module.f.ts'
import {
    isTag1,
    type Const,
    type ConstObject,
    type Info0,
    type Info1,
    type Primitive0,
    type Struct,
    type Tag1,
    type Tuple,
    type Type
} from '../module.f.ts'
import { error, ok, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject, type ReadonlyRecord } from '../../object/module.f.ts'
import { identity } from '../../function/module.f.ts'
import type { Primitive } from '../../../djs/module.f.ts'

/** Validation result: either the typed value or an error message. */
export type Result<T extends Type> = CommonResult<Ts<T>, string>

/** A function that validates an unknown value against schema `T`. */
export type Validate<T extends Type> = (value: Unknown) => Result<T>

/** Type guard narrowing `Unknown` to a specific container type `C`. */
type IsContainer<C extends Unknown> = (value: Unknown) => value is C

/** Extracts the items to validate from a container. */
type GetItems<C extends Unknown> = (value: C) => ReadonlyArray<Unknown>

/** Maps a `Tag1` to its runtime container type. */
type Container<K extends Tag1> = K extends 'array'
    ? ReadonlyArray<Unknown>
    : ReadonlyRecord<string, Unknown>

/**
 * Builds a validator for `array` or `record` schemas.
 * The inner item validator is instantiated lazily (only when the container is
 * non-empty) to avoid infinite recursion with recursive schemas.
 */
const containerValidate =
    <K extends Tag1>(isContainer: IsContainer<Container<K>>, getItems: GetItems<Container<K>>) =>
    <I extends Type>(item: I): Validate<Info1<K, I>> => value =>
{
    if (!isContainer(value)) {
        return error('unexpected value') as any
    }
    const items = getItems(value)
    if (items.length === 0) {
        return ok(value)
    }
    // Note: we shouldn't instantiate `itemValidate` until we make sure `items` is not empty.
    //       Otherwise, we can get infinite recursion on empty arrays and objects
    const itemValidate = validate(item)
    for (const i of items) {
        const r = itemValidate(i)
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value)
}

const isArray: IsContainer<ReadonlyArray<Unknown>> =
    value => commonIsArray(value)

const arrayValidate = containerValidate<'array'>(isArray, identity)

const isObject: IsContainer<ReadonlyRecord<string, Unknown>> =
    value => commonIsObject(value)

const recordValidate = containerValidate<'record'>(isObject, Object.values)

const tag1Validate = <K extends Tag1, I extends Type, T extends Info1<K, I>>([tag, item]: T): Validate<T> =>
    tag === 'array'
        ? arrayValidate(item) as any
        : recordValidate(item) as any

/** Validates a `Tag0` primitive schema using `typeof`. */
const primitive0Validate = <K extends Primitive0, T extends Info0<K>>(tag: K): Validate<T> =>
    value => typeof value === tag ? ok(value) as any : error('unexpected value') as any

/** Validates a `Thunk` schema by evaluating it once and dispatching on the resulting `Info` tag. */
/*
const thunkValidate = <T extends Thunk>(rtti: T): Validate<T> => {
    const info = rtti()
    const [tag, value] = info
    switch (tag) {
        case 'const':
            return constValidate(value) as any
        case 'unknown':
            return ok as any
    }
    return isTag1(tag)
        ? tag1Validate(info as Info1<typeof tag, typeof value>) as any
        : primitive0Validate(tag) as any
}
*/

/**
 * Builds a validator for `Tuple` or `Struct` const schemas.
 * Iterates over the schema's entries and validates each corresponding
 * element/property of the value.
 */
const constContainerValidate =
    <C extends Unknown>(isContainer: IsContainer<C>, getItem: (value: C, k: string) => Unknown) =>
    <T extends Tuple|Struct>(rtti: T): Validate<T> => value =>
{
    if (!isContainer(value)) {
        return error('unexpected value') as any
    }
    for (const [k, v] of Object.entries(rtti)) {
        const item = getItem(value, k)
        const r = (validate(v) as any)(item) as Result<T>
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value)
}

const tupleValidate = constContainerValidate<ReadonlyArray<Unknown>>(
    isArray,
    (value, k) => value[Number(k)]
)

const structValidate = constContainerValidate<ReadonlyRecord<string, Unknown>>(
    isObject,
    (value, k) => value[k]
)

const constObjectValidate = <T extends ConstObject>(rtti: T): Validate<T> =>
    commonIsArray(rtti)
        ? tupleValidate(rtti) as any
        : structValidate(rtti) as any

/** Validates a primitive `Const` schema using strict equality (`===`). */
const constPrimitiveValidate = <T extends Primitive>(rtti: T): Validate<T> =>
    value => rtti === value
        ? ok(value) as any
        : error('unexpected value') as any

const constValidate = <T extends Const>(rtti: T): Validate<T> =>
    typeof rtti === 'object' && rtti !== null
        ? constObjectValidate(rtti) as any
        : constPrimitiveValidate(rtti) as any

/**
 * Creates a validator function for the given RTTI schema.
 *
 * @param rtti - A schema `Type`: a `Thunk` for tag-based schemas, or a `Const`
 *   (primitive literal, tuple, or struct) for exact-value schemas.
 * @returns A `Validate<T>` function that checks an unknown value and returns
 *   `['ok', value]` or `['error', message]`.
 *
 * @example
 * ```ts
 * const v = validate(array(number))
 * v([1, 2, 3])   // ['ok', [1, 2, 3]]
 * v(['a', 'b'])  // ['error', 'unexpected value']
 * ```
 */
export const validate = <T extends Type>(rtti: T): Validate<T> => {
    if (typeof rtti === 'function') {
        const [tag, value] = rtti()
        switch (tag) {
            case 'const': return constValidate(value) as any
            case 'array': return arrayValidate(value) as any
            case 'record': return recordValidate(value) as any
            case 'unknown': return ok as any
        }
        return primitive0Validate(tag) as any
    }
    return constValidate(rtti) as any
}
