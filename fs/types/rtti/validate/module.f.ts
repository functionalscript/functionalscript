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
 * Schema recognition is delegated to `match` in `../common/module.f.ts`,
 * which collapses the `Type` ADT into a flat discriminated union; the
 * top-level `switch` then routes each variant to the matching handler.
 * `validate` returns the original value on success — no fresh allocation —
 * which is the only behavior that distinguishes it from `parse`.
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
    type Info1,
    type Struct,
    type Tag1,
    type Tuple,
    type Type,
} from '../module.f.ts'
import { ok } from '../../result/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject, type ReadonlyRecord } from '../../object/module.f.ts'
import {
    constPrimitiveValidate,
    match,
    prependPath,
    primitive0Validate,
    verror,
    type Validate,
} from '../common/module.f.ts'

export {
    constPrimitiveValidate,
    prependPath,
    primitive0Validate,
    verror,
    type Path,
    type Result,
    type Validate,
    type ValidationError,
} from '../common/module.f.ts'

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
        const r = (validate(v) as any)(item) as ReturnType<Validate<T>>
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

const orValidate = <T extends readonly Type[]>(rtti: T): Validate<() => readonly['or', ...T]> => {
    const all = rtti.map(r => validate(r))
    return value => {
        for (const i of all) {
            const r = (i as any)(value)
            if (r[0] === 'ok') {
                return r
            }
        }
        return verror('no match') as any
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
    const k = match(rtti)
    switch (k.kind) {
        case 'tuple': return tupleValidate(k.tuple) as any
        case 'struct': return structValidate(k.struct) as any
        case 'array': return arrayValidate(k.item) as any
        case 'record': return recordValidate(k.item) as any
        case 'or': return orValidate(k.variants) as any
        case 'constPrimitive': return constPrimitiveValidate(k.value) as any
        case 'primitive0': return primitive0Validate(k.tag) as any
        case 'unknown': return ok as any
    }
}
