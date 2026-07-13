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
 * The error shape, path bookkeeping, primitive checks, and schema
 * recognition (`visit`) are shared with `validate` through
 * `../common/module.f.ts`; only container construction differs.
 *
 * @module
 */
import {
    type Info1,
    type Struct,
    type Tag1,
    type Tuple,
    type Type,
} from '../module.f.ts'
import { ok, type Result as CommonResult } from '../../result/module.f.ts'
import type { StringMap } from '../../object/module.f.ts'
import { find, map as listMap, reverse, toArray, type List } from '../../list/module.f.ts'
import {
    constPrimitiveValidate,
    eachEntry,
    isArray,
    isObject,
    primitive0Validate,
    verror,
    visit,
    type Container,
    type IsContainer,
    type Result as CommonValidateResult,
    type Validate,
    type ValidationError,
    type Visitor,
} from '../common/module.f.ts'
import type { Unknown } from '../ts/module.f.ts'

export { type Path, type ValidationError } from '../common/module.f.ts'

const { entries } = Object

/** Parse result: either the freshly constructed typed value or a `ValidationError`. */
export type Result<T extends Type> = CommonValidateResult<T>

/** A function that parses an unknown value into the schema `T`. */
export type Parse<T extends Type> = Validate<T>

type ItemResult = CommonResult<Unknown, ValidationError>

/** Rebuilds a parsed container from its `[key, parsedValue]` entries. */
type Rebuild = (entries: ReadonlyArray<readonly[string, Unknown]>) => Unknown

const arrayRebuild: Rebuild = entries => entries.map(([, v]) => v)

const recordRebuild: Rebuild = entries => Object.fromEntries(entries)

/** `eachEntry`'s accumulator seed: entries are consed on in reverse as they parse. */
const emptyEntries: List<readonly [string, Unknown]> = null

/** `eachEntry`'s accumulate step: an O(1) prepend, unlike rebuilding an array on every entry. */
const consEntry = (acc: List<readonly [string, Unknown]>, k: string, v: Unknown): List<readonly [string, Unknown]> =>
    ({ first: [k, v], tail: acc })

/** Restores forward order from `consEntry`'s reverse-order list, in one linear pass. */
const orderedEntries = (list: List<readonly [string, Unknown]>): ReadonlyArray<readonly [string, Unknown]> =>
    toArray(reverse(list))

/**
 * Builds a parser for `array` or `record` schemas. Mirrors `validate`'s
 * `containerValidate`, but rebuilds a fresh container from each item's parsed
 * result instead of returning the value unchanged. The inner item parser is
 * instantiated lazily (only when the container is non-empty) so recursive
 * schemas don't recurse forever on empty containers.
 */
const containerParse =
    <K extends Tag1>(
        isContainer: IsContainer<Container<K>>,
        rebuild: Rebuild,
    ) =>
    <I extends Type>(item: I): Parse<Info1<K, I>> => value =>
{
    if (!isContainer(value)) {
        return verror('unexpected value')
    }
    const e = entries(value)
    if (e.length === 0) {
        return ok(rebuild([])) as any
    }
    const itemParse = parse(item) as (v: Unknown) => ItemResult
    const r = eachEntry(e, (_k, v) => itemParse(v), emptyEntries, consEntry)
    return r[0] === 'error' ? r : ok(rebuild(orderedEntries(r[1]))) as any
}

const arrayParse = containerParse<'array'>(isArray, arrayRebuild)

const recordParse = containerParse<'record'>(isObject, recordRebuild)

/**
 * Builds a parser for `Tuple` or `Struct` const schemas. Mirrors `validate`'s
 * `constContainerValidate`: it iterates the schema's entries (so extra tuple
 * elements and undeclared struct keys are dropped) and rebuilds the result
 * from each parsed item.
 */
const constContainerParse =
    <C extends Unknown>(
        isContainer: IsContainer<C>,
        getItem: (value: C, k: string) => Unknown,
        rebuild: Rebuild,
    ) =>
    <T extends Tuple|Struct>(rtti: T): Parse<T> => value =>
{
    if (!isContainer(value)) {
        return verror('unexpected value')
    }
    const r = eachEntry(
        entries(rtti),
        (k, t) => (parse(t) as any)(getItem(value, k)) as ItemResult,
        emptyEntries,
        consEntry,
    )
    return r[0] === 'error' ? r : ok(rebuild(orderedEntries(r[1]))) as any
}

const tupleParse = constContainerParse<ReadonlyArray<Unknown>>(
    isArray,
    (value, k) => value[Number(k)],
    arrayRebuild,
)

const structParse = constContainerParse<StringMap<string, Unknown>>(
    isObject,
    (value, k) => value[k],
    recordRebuild,
)

const findFirst = find
    (verror('no match'))
    ((k: any) => k[0] === 'ok')

const orParse = <T extends readonly Type[]>(rtti: T): Parse<() => readonly['or', ...T]> =>
    // `parse(t)` where t: Type forces Ts<Type> evaluation → TS2589; cast keeps result as any.
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
const parseVisitor = {
    tuple: tupleParse,
    struct: structParse,
    array: arrayParse,
    record: recordParse,
    or: orParse,
    constPrimitive: constPrimitiveValidate,
    primitive0: primitive0Validate,
    unknown: () => ok,
} as unknown as Visitor<(value: Unknown) => unknown>

export const parse = <T extends Type>(rtti: T): Parse<T> =>
    visit(parseVisitor)(rtti) as any
