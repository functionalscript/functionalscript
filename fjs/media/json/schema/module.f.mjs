/**
 * Converts an rtti schema to a JSON Schema (draft 2020-12) object.
 *
 * {@link toJsonSchema} routes through the serializable RTTI data form
 * (`fjs/types/rtti/data`): `thunk RTTI → toData → dataToJsonSchema`. The data
 * form is a finite graph, so recursive schemas — which the thunk graph
 * represents as self-referencing functions with no leaves — terminate:
 * every named rule is emitted exactly once under `$defs` and every graph
 * edge becomes a local `$ref`.
 *
 * Graph discovery, canonical identity, and definition naming belong to the
 * RTTI data layer; this module only translates the finite graph, so the
 * output is deterministic for equal canonical data: `anyOf` members follow
 * the data form's kind order (`null`, `undefined`, booleans, numbers,
 * strings, bigints, arrays, objects), and `properties`/`required` follow
 * its sorted key order.
 *
 * @module
 *
 * @import { Type as RttiType } from '../../../types/rtti/types.ts'
 * @import { ArraySet, Data, KindSet, Node, ObjectSet, RuleSet, UnionSet } from '../../../types/rtti/data/types.ts'
 * @import { Ts, Check } from '../../../types/rtti/ts/types.ts'
 * @import { Phantom } from '../../../types/phantom/types.ts'
 * @import { Assert } from '../../../asserts/types.ts'
 */

import { assert, assertNotNullish } from '../../../asserts/module.f.mjs'
import { at, definedEntries } from '../../../types/object/module.f.mjs'
import { array, number, option, or, record, string } from '../../../types/rtti/module.f.mjs'
import { cmp, toData, unitBit, unknown as top, withoutUnits } from '../../../types/rtti/data/module.f.mjs'
import { unknown as jsonUnknown } from '../rtti/module.f.mjs'

/** @type {() => readonly ['const', typeof unknownConst]} */
const unknownThunk = () => ['const', unknownConst]

/**
 * rtti schema for a JSON Schema (draft 2020-12) document.
 * @type {Phantom<typeof unknownThunk, _UnknownConst>}
 */
export const unknown = unknownThunk

/**
 * Checked against the un-annotated thunk, so a wrong `_UnknownConst` above
 * would be caught here instead of silently trusted via the `Phantom` lie.
 * @typedef {Assert<Check<_UnknownConst, typeof unknownThunk>>} _UnknownCheck0
 */
/** @typedef {Assert<Check<_UnknownConst, typeof unknown>>} _UnknownCheck1 */

/** A JSON Schema (draft 2020-12) document — the subset of keywords that `toJsonSchema` emits. */
/** @typedef {Ts<typeof unknown>} Unknown */

const unknownConst = /** @type {const} */ ({
    $schema: option(string),
    $ref: option(string),
    $defs: option(record(unknown)),
    type: or('boolean', 'number', 'string', 'integer', 'array', 'object', undefined),
    const: option(jsonUnknown),
    not: option(unknown),
    anyOf: option(array(unknown)),
    items: or(unknown, false, undefined),
    prefixItems: option(array(unknown)),
    minItems: option(number),
    properties: option(record(unknown)),
    required: option(array(string)),
    additionalProperties: option(unknown),
})

/**
 * Hand-written base type used as the `$out` annotation on `unknown`.
 *
 * The `?` markers are required even though `Ts<>` already includes `undefined`
 * in each field type. Without `?`, `Unknown = _UnknownConst` would require all
 * 12 fields to be present in every object literal returned by `toJsonSchema`,
 * because TypeScript distinguishes "field absent" (`?`) from "field present but
 * undefined" (`T | undefined`). JSON Schema objects only include the fields
 * they need, so all fields must be optional. `$defs` is an *open* map — an
 * absent entry types as `undefined`, so missing-reference handling cannot be
 * skipped.
 * @typedef {{
 *   readonly $schema?: Ts<typeof unknownConst.$schema>
 *   readonly $ref?: Ts<typeof unknownConst.$ref>
 *   readonly $defs?: Ts<typeof unknownConst.$defs>
 *   readonly type?: Ts<typeof unknownConst.type>
 *   readonly const?: Ts<typeof unknownConst.const>
 *   readonly not?: Ts<typeof unknownConst.not>
 *   readonly anyOf?: Ts<typeof unknownConst.anyOf>
 *   readonly items?: Ts<typeof unknownConst.items>
 *   readonly prefixItems?: Ts<typeof unknownConst.prefixItems>
 *   readonly minItems?: Ts<typeof unknownConst.minItems>
 *   readonly properties?: Ts<typeof unknownConst.properties>
 *   readonly required?: Ts<typeof unknownConst.required>
 *   readonly additionalProperties?: Ts<typeof unknownConst.additionalProperties>
 * }} _UnknownConst
 */

const nullBit = unitBit(null)
const undefinedBit = unitBit(undefined)
const falseBit = unitBit(false)
const trueBit = unitBit(true)
const booleanBits = falseBit | trueBit

/**
 * Encodes a definition name for use inside a local `$ref` URI fragment:
 * JSON Pointer escaping first (`~` → `~0`, `/` → `~1`), then
 * percent-encoding of the remaining code points for the URI-fragment path
 * segment. The order matters: a literal name `%2F` must encode to `%252F`,
 * so URI decoding restores the literal `%2F` segment instead of a `/` that
 * JSON Pointer evaluation would then misread as a separator.
 *
 * @type {(name: string) => string}
 */
const refEncode = name => {
    let result = ''
    for (const c of name) {
        result += c === '~' ? '~0' : c === '/' ? '~1' : encodeURIComponent(c)
    }
    return result
}

/**
 * A local `$ref` to a named definition. A reference must name an existing
 * definition — a dangling name is malformed data and panics. The lookup is
 * own-property only, so a name inherited from `Object.prototype`
 * (`toString`, `constructor`, …) is still rejected.
 *
 * @type {(rules: RuleSet) => (name: string) => Unknown}
 */
const refSchema = rules => name => {
    assert(at(name)(rules) !== null, `missing definition: ${name}`)
    return { $ref: `#/$defs/${refEncode(name)}` }
}

/** @type {(rules: RuleSet) => (n: Node) => Unknown} */
const nodeSchema = rules => n =>
    typeof n === 'string' ? refSchema(rules)(n) : unionSchema(rules)(n)

/**
 * The schemas of one kind component: nothing when absent, the whole kind
 * when `true`, one schema per member otherwise.
 *
 * @template T
 * @param {KindSet<T> | undefined} k
 * @param {Unknown} whole
 * @param {(v: T) => Unknown} item
 * @returns {readonly Unknown[]}
 */
const kindSchemas = (k, whole, item) =>
    k === undefined ? [] :
    k === true ? [whole] :
    k.map(item)

/** @type {(v: boolean | number | string | null) => Unknown} */
const constSchema = v => ({ const: v })

/** bigint consts are represented as numbers (lossy for |value| > MAX_SAFE_INTEGER) */
/** @type {(v: bigint) => Unknown} */
const bigintConstSchema = v => ({ const: Number(v) })

/**
 * The unit kind: `null` and `undefined` are their own singletons — no JSON
 * value is `undefined`, hence `{ "not": {} }` — and both boolean bits
 * together are the `boolean` type with no special-case rule.
 *
 * @type {(bits: number) => readonly Unknown[]}
 */
const unitSchemas = bits => [
    ...((bits & nullBit) === 0 ? [] : [constSchema(null)]),
    ...((bits & undefinedBit) === 0 ? [] : [{ not: {} }]),
    ...((bits & booleanBits) === booleanBits ? [{ type: /** @type {const} */ ('boolean') }]
        : (bits & falseBit) !== 0 ? [constSchema(false)]
        : (bits & trueBit) !== 0 ? [constSchema(true)]
        : []),
]

/**
 * A set of arrays: `prefixItems` for the tuple prefix, `items` for the
 * elements past it — `false` when the length is exact, so a tuple admits
 * nothing beyond its prefix and the empty tuple is `{ "items": false }`.
 * `prefixItems` alone constrains only elements that exist (draft 2020-12
 * implies no minimum length), so a non-empty prefix also emits `minItems`.
 *
 * @type {(rules: RuleSet) => (p: ArraySet) => Unknown}
 */
const arraySetSchema = rules => p => ({
    type: 'array',
    ...(p.prefix.length === 0 ? {} : {
        prefixItems: p.prefix.map(nodeSchema(rules)),
        minItems: p.prefix.length,
    }),
    items: p.rest === undefined ? false : nodeSchema(rules)(p.rest),
})

/** Whether the node's value set admits `undefined` — its unit bit, read
 * through a reference if needed.
 * @type {(rules: RuleSet) => (n: Node) => boolean}
 */
const admitsUndefined = rules => n => {
    const u = typeof n === 'string' ? assertNotNullish(at(n)(rules)) : n
    return ((u.unit ?? 0) & undefinedBit) !== 0
}

/**
 * The node with `undefined` removed — for an optional property's schema,
 * where absence is already expressed by the key not being `required`. A
 * reference is kept as-is: its definition is shared, and the extra
 * `{ "not": {} }` member it may carry matches no JSON value anyway.
 *
 * @type {(n: Node) => Node}
 */
const stripUndefined = n =>
    typeof n === 'string' ? n : withoutUnits(undefinedBit)(n)

/**
 * A set of objects: `properties` for the declared keys — a key admitting
 * `undefined` is optional and has `undefined` stripped from its schema,
 * every other key is `required` — and `additionalProperties` for the rest.
 * No `rest` leaves the other keys unconstrained (lenient), matching rtti's
 * open-struct validation semantics.
 *
 * @type {(rules: RuleSet) => (p: ObjectSet) => Unknown}
 */
const objectSetSchema = rules => p => {
    const ents = definedEntries(p.props)
    const required = ents.filter(([, n]) => !admitsUndefined(rules)(n)).map(([k]) => k)
    return {
        type: 'object',
        ...(ents.length === 0 ? {} : {
            properties: Object.fromEntries(ents.map(
                ([k, n]) => /** @type {const} */ ([k, nodeSchema(rules)(stripUndefined(n))]))),
        }),
        ...(required.length === 0 ? {} : { required }),
        ...(p.rest === undefined ? {} : { additionalProperties: nodeSchema(rules)(p.rest) }),
    }
}

/** @type {(u: UnionSet) => boolean} */
const isTop = u => cmp([{}, u])([{}, top]) === 0

/** @type {(rules: RuleSet) => (u: UnionSet) => Unknown} */
const unionSchema = rules => u => {
    if (isTop(u)) { return {} }
    const members = [
        ...unitSchemas(u.unit ?? 0),
        ...kindSchemas(u.number, { type: 'number' }, constSchema),
        ...kindSchemas(u.string, { type: 'string' }, constSchema),
        ...kindSchemas(u.bigint, { type: 'integer' }, bigintConstSchema),
        ...kindSchemas(u.array, { type: 'array' }, arraySetSchema(rules)),
        ...kindSchemas(u.object, { type: 'object' }, objectSetSchema(rules)),
    ]
    return members.length === 0 ? { not: {} }
        : members.length === 1 ? members[0]
        : { anyOf: members }
}

/**
 * Converts a serializable RTTI {@link Data} (from `toData`) to a JSON Schema
 * (draft 2020-12) object.
 *
 * Every named rule is emitted exactly once under `$defs` and each reference
 * becomes a local `$ref` — self- and mutual recursion terminate, and the
 * root itself is a `$ref` when the entry is a named definition. Definition
 * names come from the data form (deterministic for equal canonical data)
 * and are JSON Pointer-escaped, then percent-encoded, for the `$ref`
 * fragment. A reference naming a missing definition panics.
 *
 * @type {(data: Data) => Unknown}
 */
export const dataToJsonSchema = ([rules, entry]) => {
    const ruleEntries = definedEntries(rules)
    const root = nodeSchema(rules)(entry)
    return ruleEntries.length === 0 ? root : {
        ...root,
        $defs: Object.fromEntries(ruleEntries.map(
            ([name, u]) => /** @type {const} */ ([name, unionSchema(rules)(u)]))),
    }
}

/**
 * Converts an rtti `Type` to a JSON Schema (draft 2020-12) object, through
 * the canonical data form: `toData` first, then {@link dataToJsonSchema}.
 *
 * | rtti                                          | JSON Schema                                                                         |
 * |-----------------------------------------------|-------------------------------------------------------------------------------------|
 * | `boolean` / `number` / `string`               | `{ "type": "..." }`                                                                 |
 * | `bigint`                                      | `{ "type": "integer" }` (lossy; JSON integers are IEEE-754 doubles)                 |
 * | `unknown`                                     | `{}` (always-true schema)                                                           |
 * | `never` / `or()`                              | `{ "not": {} }` (no JSON value satisfies this)                                      |
 * | primitive const (`42`, `'x'`, `null`)         | `{ "const": <value> }`                                                              |
 * | `or(true, false)`                             | `{ "type": "boolean" }` (the union normalizes to the whole kind)                    |
 * | `bigint` const                                | `{ "const": Number(value) }` (lossy for \|value\| > MAX_SAFE_INTEGER)               |
 * | `undefined` const                             | `{ "not": {} }`                                                                     |
 * | struct `{ a: T, … }`                          | `{ "type": "object", "properties": { "a": …T… }, "required": [non-optional keys] }` |
 * | tuple `[A, B]`                                | `{ "type": "array", "prefixItems": […A…, …B…], "minItems": 2, "items": false }`     |
 * | `array(T)`                                    | `{ "type": "array", "items": …T… }`                                                 |
 * | `record(T)`                                   | `{ "type": "object", "additionalProperties": …T… }`                                 |
 * | `or(...types)`                                | `{ "anyOf": […each…] }`, normalized and in canonical kind order                     |
 * | recursive schema                              | `{ "$ref": "#/$defs/<name>", "$defs": { "<name>": … } }`                            |
 *
 * The union rows follow the data form's normalization: operands are merged
 * kind-wise, literals covered by their whole kind are absorbed
 * (`or(42, number)` is all numbers), subsumed patterns are dropped, and
 * duplicates collapse — so structurally different but equivalent thunk
 * schemas produce the same JSON Schema.
 *
 * @type {(rtti: RttiType) => Unknown}
 */
export const toJsonSchema = rtti => dataToJsonSchema(toData(rtti))
