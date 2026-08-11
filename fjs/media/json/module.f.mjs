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

/** @import { List } from '../../types/list/types.ts' */
import { next, flat, map } from '../../types/list/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
/** @import { Result } from '../../types/result/types.ts' */
import { parse as parseTokens } from './parser/module.f.mjs'
import { tokenize } from './tokenizer/module.f.mjs'
import { at, definedEntries } from '../../types/object/module.f.mjs'
import { compose, fn } from '../../types/function/module.f.mjs'
import { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } from './serializer/module.f.mjs'
import { boolean as rttiBoolean, number as rttiNumber, string as rttiString, or, record, array as rttiArray } from '../../types/rtti/module.f.mjs'
/** @import { Unknown, Object, Entry } from './types.ts' */

/** @typedef {(entries: List<Entry>) => List<Entry>} MapEntries */

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
export const unknown = () => /** @type {const} */ (['or', primitive, object, array])

/**
 * rtti schema matching a JSON object: `{ readonly [k: string]?: Unknown }`.
 */
export const object = record(unknown)

/** rtti schema matching a JSON array: `readonly Unknown[]`. */
export const array = rttiArray(unknown)

// ── JSON utilities ────────────────────────────────────────────────────────────

/** @type {(value: Unknown) => (path: List<string>) => (src: Unknown) => Unknown} */
export const setProperty = value => {
    /** @type {(path: List<string>) => (src: Unknown) => Unknown} */
    const f = path => src => {
        const result = next(path)
        if (result === null) { return value }
        const srcObject = (src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(at(first)(srcObject)) }
    }
    return f
}

const colon = [':']

/** @type {(mapEntries: MapEntries) => (value: Unknown) => List<string>} */
export const serialize = sort => {
    /** @type {(kv: readonly [string, Unknown]) => List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    const objectSerialize = fn(/** @type {(o: Object) => readonly (readonly [string, Unknown])[]} */ (definedEntries))
        .map(sort)
        .map(mapPropertySerialize)
        .map(objectWrap)
        .result
    /** @type {(value: Unknown) => List<string>} */
    const f = value => {
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
 *
 * @type {(mapEntries: MapEntries) => (value: Unknown) => string}
 */
export const stringify = sort => compose(serialize(sort))(concat)

/**
 * Parses `text` as JSON with this module's own pure tokenizer and parser,
 * reporting failure as a `Result` rather than throwing: malformed input is
 * *available* as an `error` to branch on. Whether to branch or to `unwrap` it
 * back into a panic is the caller's decision — the parser no longer makes it
 * for them.
 *
 * The result is an untyped {@link Unknown}; narrow it to a domain type with an
 * rtti schema (`fjs/types/rtti/parse`) rather than with an `as` cast.
 *
 * @type {(text: string) => Result<Unknown, string>}
 */
export const parse = text => parseTokens(tokenize(stringToList(text)))
