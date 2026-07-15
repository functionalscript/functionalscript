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
 * Schema recognition is delegated to `visit` in `../common/module.f.ts`,
 * which routes each `Type` variant to a handler in the `Visitor` record
 * defined below. `validate` returns the original value on success — no
 * fresh allocation — which is the only behavior that distinguishes it
 * from `parse`.
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
import type { StringMap } from '../../object/module.f.ts'
import {
    constPrimitiveValidate,
    eachEntry,
    isArray,
    isObject,
    orVisit,
    primitive0Validate,
    verror,
    visit,
    type Container,
    type IsContainer,
    type Validate,
    type ValidateE,
    type Visitor,
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

const { entries } = Object

/** `validate` has nothing to collect from a successful entry — only pass/fail matters. */
const noAccumulate = (): undefined => undefined

/**
 * Builds a validator for `array` or `record` schemas.
 * The inner item validator is instantiated lazily (only when the container is
 * non-empty) to avoid infinite recursion with recursive schemas.
 */
const containerValidate =
    <K extends Tag1>(isContainer: IsContainer<Container<K>>) =>
    <I extends Type>(item: I): Validate<Info1<K, I>> => value =>
{
    if (!isContainer(value)) {
        return verror('unexpected value')
    }
    const e = entries(value)
    if (e.length === 0) {
        return ok(value)
    }
    // Note: we shouldn't instantiate `itemValidate` until we make sure `entries` is not empty.
    //       Otherwise, we can get infinite recursion on empty arrays and objects
    const itemValidate = validate(item)
    const r = eachEntry(e, (_k, v) => itemValidate(v), undefined, noAccumulate)
    // `value` is Container<K>, but Ts<Info1<K,I>> = readonly Ts<I>[] | Record<string,Ts<I>>.
    // TypeScript can't narrow the container's element types through the validation loop.
    return r[0] === 'error' ? r : ok(value) as any
}

const arrayValidate = containerValidate<'array'>(isArray)

const recordValidate = containerValidate<'record'>(isObject)

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
        return verror('unexpected value')
    }
    const r = eachEntry(
        Object.entries(rtti),
        (k, v) => (validate(v) as any)(getItem(value, k)) as ReturnType<Validate<T>>,
        undefined,
        noAccumulate,
    )
    // `value` is C (Unknown container), but Ts<T> for T extends Tuple|Struct is not
    // structurally equivalent to C — TypeScript can't narrow element types through the loop.
    return r[0] === 'error' ? r : ok(value) as any
}

const tupleValidate = constContainerValidate<ReadonlyArray<Unknown>>(
    isArray,
    (value, k) => value[Number(k)]
)

const structValidate = constContainerValidate<StringMap<string, Unknown>>(
    isObject,
    (value, k) => value[k]
)

const orValidate = <T extends readonly Type[]>(rtti: T): Validate<() => readonly['or', ...T]> =>
    orVisit(validate as (t: Type) => ValidateE)(rtti) as Validate<() => readonly['or', ...T]>

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
const validateVisitor = {
    tuple: tupleValidate,
    struct: structValidate,
    array: arrayValidate,
    record: recordValidate,
    or: orValidate,
    constPrimitive: constPrimitiveValidate,
    primitive0: primitive0Validate,
    unknown: () => ok,
} as unknown as Visitor<(value: Unknown) => unknown>

export const validate = <T extends Type>(rtti: T): Validate<T> =>
    visit(validateVisitor)(rtti) as any
