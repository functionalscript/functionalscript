/**
 * Runtime validation of unknown values against RTTI schemas.
 *
 * The main entry point is `validate(rtti)`, which takes a schema `Type` and returns
 * a `Validate<T>` function. When called with an unknown value, it returns a `Result`
 * that is either `['ok', typedValue]` or `['error', { path, message }]`.
 *
 * ## Error path
 *
 * On failure, the error carries a `path` pointing at the offending sub-value:
 * each step is the string property name (for structs/records) or the stringified
 * index (for tuples/arrays). The path is empty when the failure is at the root.
 *
 * ## Dispatch strategy
 *
 * - **`Thunk`** schemas are evaluated lazily: the thunk is called once to obtain an
 *   `Info` descriptor, then dispatched by tag:
 *   - `'const'` — delegates to `constValidate`
 *   - `'unknown'` — always succeeds (any DJS value is valid)
 *   - `Tag1` (`'array'`, `'record'`) — delegates to `containerValidate`
 *   - `Tag0` (`'boolean'`, `'number'`, `'string'`, `'bigint'`) — uses `typeof` check
 *   - `'or'` — tries each variant; reports `'no match'` at the current location if all fail
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
    analyzeOr,
    orAnalysis,
    type Const,
    type ConstObject,
    type Info0,
    type Info1,
    type OrAnalysis,
    type Primitive0,
    type Struct,
    type Tag1,
    type Tuple,
    type Type
} from '../module.f.ts'
import { error, ok, type Error, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject, type ReadonlyRecord } from '../../object/module.f.ts'
import type { Primitive } from '../../../djs/module.f.ts'

/** A path to a sub-value within the validated structure. Each step is an object key or stringified array index. */
export type Path = readonly string[]

/** Detailed validation failure: the offending `path` plus a short `message`. */
export type ValidationError = {
    readonly path: Path
    readonly message: string
}

/** Validation result: either the typed value or a `ValidationError`. */
export type Result<T extends Type> = CommonResult<Ts<T>, ValidationError>

/** A function that validates an unknown value against schema `T`. */
export type Validate<T extends Type> = (value: Unknown) => Result<T>

/** Builds an error result with empty path and the given message. */
export const verror = (message: string): Error<ValidationError> =>
    error({ path: [], message })

/** Prepends `key` to the error's path, used to build the path bottom-up. */
export const prependPath = (key: string, r: Error<ValidationError>): Error<ValidationError> =>
    error({ path: [key, ...r[1].path], message: r[1].message })

/** Type guard narrowing `Unknown` to a specific container type `C`. */
type IsContainer<C extends Unknown> = (value: Unknown) => value is C

/** Extracts `[key, value]` entries from a container, with stringified keys for path reporting. */
type GetEntries<C extends Unknown> = (value: C) => ReadonlyArray<readonly[string, Unknown]>

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
    <K extends Tag1>(isContainer: IsContainer<Container<K>>, getEntries: GetEntries<Container<K>>) =>
    <I extends Type>(item: I): Validate<Info1<K, I>> => value =>
{
    if (!isContainer(value)) {
        return verror('unexpected value') as any
    }
    const entries = getEntries(value)
    if (entries.length === 0) {
        return ok(value)
    }
    // Note: we shouldn't instantiate `itemValidate` until we make sure `entries` is not empty.
    //       Otherwise, we can get infinite recursion on empty arrays and objects
    const itemValidate = validate(item)
    for (const [k, v] of entries) {
        const r = itemValidate(v)
        if (r[0] === 'error') {
            return prependPath(k, r) as any
        }
    }
    return ok(value)
}

const isArray: IsContainer<ReadonlyArray<Unknown>> =
    value => commonIsArray(value)

const arrayEntries = (value: ReadonlyArray<Unknown>): ReadonlyArray<readonly[string, Unknown]> =>
    value.map((v, i) => [String(i), v] as const)

const arrayValidate = containerValidate<'array'>(isArray, arrayEntries)

const isObject: IsContainer<ReadonlyRecord<string, Unknown>> =
    value => commonIsObject(value)

const recordValidate = containerValidate<'record'>(isObject, Object.entries)

/** Validates a `Tag0` primitive schema using `typeof`. */
export const primitive0Validate = <K extends Primitive0, T extends Info0<K>>(tag: K): Validate<T> =>
    value => typeof value === tag ? ok(value) as any : verror('unexpected value') as any

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
        return verror('unexpected value') as any
    }
    for (const [k, v] of Object.entries(rtti)) {
        const item = getItem(value, k)
        const r = (validate(v) as any)(item) as Result<T>
        if (r[0] === 'error') {
            return prependPath(k, r) as any
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
export const constPrimitiveValidate = <T extends Primitive>(rtti: T): Validate<T> =>
    value => rtti === value
        ? ok(value) as any
        : verror('unexpected value') as any

const constValidate = <T extends Const>(rtti: T): Validate<T> =>
    typeof rtti === 'object' && rtti !== null
        ? constObjectValidate(rtti) as any
        : constPrimitiveValidate(rtti) as any

const orValidate = (a: OrAnalysis) => {
    const { primitives, others } = a
    const all = others.map(r => validate(r))
    return (value: Unknown) => {
        if (primitives.has(value)) {
            return ok(value)
        }
        for (const i of all) {
            const r = (i as any)(value)
            if (r[0] === 'ok') {
                return r
            }
        }
        return verror('no match')
    }
}

/**
 * Creates a validator function for the given RTTI schema.
 *
 * @param rtti - A schema `Type`: a `Thunk` for tag-based schemas, or a `Const`
 *   (primitive literal, tuple, or struct) for exact-value schemas.
 * @returns A `Validate<T>` function that checks an unknown value and returns
 *   `['ok', value]` or `['error', { path, message }]`.
 *
 * @example
 * ```ts
 * const v = validate(array(number))
 * v([1, 2, 3])         // ['ok', [1, 2, 3]]
 * v([1, 'two'])        // ['error', { path: ['1'], message: 'unexpected value' }]
 * v(['a'])             // ['error', { path: ['0'], message: 'unexpected value' }]
 * ```
 */
export const validate = <T extends Type>(rtti: T): Validate<T> => {
    if (typeof rtti === 'function') {
        const [tag, ...value] = rtti()
        switch (tag) {
            case 'const': return constValidate(value[0] as Const) as any
            case 'array': return arrayValidate(value[0]) as any
            case 'record': return recordValidate(value[0]) as any
            case 'unknown': return ok as any
            case 'or': return orValidate(orAnalysis(rtti) ?? analyzeOr(value)) as any
        }
        return primitive0Validate(tag) as any
    }
    return constValidate(rtti) as any
}
