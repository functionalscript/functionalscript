/**
 * JSON value types, rtti schemas, and utilities: `serialize`, `stringify`,
 * `parse`, and `setProperty` for immutable nested updates.
 *
 * `parse` is the total, `Result`-returning `text → Unknown` entry point built
 * on this module's own tokenizer and parser.
 *
 * The JSON value types (`Unknown`, `Primitive`) are derived from the rtti
 * schemas defined here, so the schema is the single source of truth — no
 * hand-written types to keep in sync.
 *
 * @module
 */
import type { List } from '../../types/list/types.ts'
import { next, flat, map } from '../../types/list/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import type { Result } from '../../types/result/types.ts'
import { parse as parseTokens } from './parser/module.f.ts'
import { tokenize } from './tokenizer/module.f.ts'
import { at, definedEntries } from '../../types/object/module.f.mjs'
import type { Entry as ObjectEntry } from '../../types/object/types.ts'
import { compose, fn } from '../../types/function/module.f.mjs'
import { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from './serializer/module.f.mjs'
import { boolean as rttiBoolean, number as rttiNumber, string as rttiString, or, record, array as rttiArray } from '../../types/rtti/module.f.mjs'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'

// ── rtti schemas ──────────────────────────────────────────────────────────────

/** rtti schema matching any JSON primitive: `null`, `boolean`, `number`, or `string`. */
export const primitive = or(null, rttiBoolean, rttiNumber, rttiString)

/**
 * rtti schema matching any JSON value: a primitive, an array of JSON values,
 * or an object whose values are JSON values. Self-referential via a thunk;
 * rtti instantiates array/record item validators lazily so recursion terminates
 * on acyclic input.
 *
 * A struct field typed `unknown` is **required when present** — unlike rtti
 * core's `unknown`, the JSON `unknown` excludes `undefined`.
 */
export const unknown = () => ['or', primitive, object, array] as const

/**
 * rtti schema matching a JSON object: `{ readonly [k: string]?: Unknown }`.
 */
export const object = record(unknown)

/** rtti schema matching a JSON array: `readonly Unknown[]`. */
export const array = rttiArray(unknown)

// ── TypeScript types (derived from schemas — single source of truth) ──────────

export type Primitive = Ts<typeof primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

type _Unknown = Assert<Equal<Unknown, Ts<typeof unknown>>>

// ── JSON utilities ────────────────────────────────────────────────────────────

export const setProperty = (value: Unknown) => {
    const f = (path: List<string>) => (src: Unknown): Unknown =>{
        const result = next(path)
        if (result === null) { return value }
        const srcObject = (src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(at(first)(srcObject)) }
    }
    return f
}

const colon = [':']

export type Entry = ObjectEntry<Unknown>

type Entries = List<Entry>

type MapEntries = (entries: Entries) => Entries

export const serialize
    : (mapEntries: MapEntries) => (value: Unknown) => List<string>
    = sort => {
        const propertySerialize
            : (kv: readonly[string, Unknown]) => List<string>
            = ([k, v]) => flat([
            stringSerialize(k),
            colon,
            f(v)
        ])
        const mapPropertySerialize = map(propertySerialize)
        const objectSerialize
            : (object: Object) => List<string>
            = fn(definedEntries<Unknown>)
            .map(sort)
            .map(mapPropertySerialize)
            .map(objectWrap)
            .result
        const f = (value: Unknown): List<string> => {
            switch (typeof value) {
                case 'boolean': { return boolSerialize(value) }
                case 'number': { return numberSerialize(value) }
                case 'string': { return stringSerialize(value) }
                default: {
                    if (value === null) { return nullSerialize }
                    if (value instanceof Array) { return arraySerialize(value) }
                    return objectSerialize(value)
                }
            }
        }
        const arraySerialize = compose(map(f))(arrayWrap)
        return f
    }

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 * https://tc39.es/ecma262/#sec-serializejsonproperty
 */
export const stringify
    : (mapEntries: MapEntries) => (value: Unknown) => string
    = sort => compose(serialize(sort))(concat)

/**
 * Parses `text` as JSON with this module's own pure tokenizer and parser,
 * reporting failure as a `Result` rather than throwing: malformed input is
 * *available* as an `error` to branch on. Whether to branch or to `unwrap` it
 * back into a panic is the caller's decision — the parser no longer makes it
 * for them.
 *
 * The result is an untyped {@link Unknown}; narrow it to a domain type with an
 * rtti schema (`fjs/types/rtti/parse`) rather than with an `as` cast.
 */
export const parse
    : (text: string) => Result<Unknown, string>
    = text => parseTokens(tokenize(stringToList(text)))
