/**
 * Runtime printer mirroring the `Ts<T>` type transformer for RTTI schemas.
 * See `./types.ts` for `Ts<T>` and the `*Ts` transformer types.
 *
 * The printer routes through the serializable RTTI data form
 * (`fjs/rtti/data`): `thunk RTTI → toData → dataToTs`. The data form
 * is a finite graph, so recursive schemas — which the thunk graph represents
 * as self-referencing functions with no leaves — terminate: every named rule
 * becomes a TypeScript type-alias definition and every graph edge prints as
 * that alias's identifier. Output is canonical: union members follow the
 * data form's kind order and object keys its sorted order, so structurally
 * different but equivalent schemas print identically.
 *
 * @module
 *
 * @import { StructField } from '../../types/ts/types.ts'
 * @import { Type } from '../types.ts'
 * @import { ArraySet, Data, Node, ObjectSet, RuleSet, UnionAlgebra, UnionSet } from '../data/types.ts'
 * @import { _Ctx } from './private.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.mjs'
import { assoc, dedup } from '../../types/array/module.f.mjs'
import { reservedWords, strictModeReservedWords } from '../../js/keywords/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { primitive, union, printer as tsPrinter } from '../../types/ts/module.f.mjs'
import {
    absentBit,
    admitsAbsence as dataAdmitsAbsence,
    isNever as dataIsNever,
    requiredPrefix,
    resolve,
    toData,
    undefinedBit,
    unionFold,
} from '../data/module.f.mjs'

/**
 * Names that cannot name a TypeScript type alias: the ECMAScript reserved
 * words — from the one source of truth for JavaScript keywords,
 * `fjs/js/keywords`, the strict-mode ones included since every module is
 * strict-mode code (`TS1214`) — plus TypeScript's predefined type names
 * (`TS2457`) and the type keywords that fail in the alias-name position.
 */
/** @type {readonly string[]} */
const reserved = [
    ...reservedWords,
    ...strictModeReservedWords,
    // predefined type names
    'any', 'bigint', 'boolean', 'never', 'number', 'object', 'string',
    'symbol', 'undefined', 'unknown',
    // type-operator keywords, and `intrinsic` (TS2795 outside lib.d.ts)
    'infer', 'intrinsic', 'keyof', 'readonly', 'unique',
]

/** @type {(c: string) => boolean} */
const isIdStart = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'

/** @type {(c: string) => boolean} */
const isIdPart = c => isIdStart(c) || (c >= '0' && c <= '9')

/** Whether `s` can name a TypeScript type alias. */
/** @type {(s: string) => boolean} */
const isTypeName = s =>
    s !== ''
    && [...s].every((c, i) => i === 0 ? isIdStart(c) : isIdPart(c))
    && !reserved.some(p => p === s)

/**
 * Maps every rule name to a TypeScript type-alias identifier: the name
 * itself when it can be one, else a deterministic generated `T<n>` that
 * collides with no kept name.
 *
 * @type {(rules: RuleSet) => readonly (readonly [string, string])[]}
 */
const identifiers = rules => {
    const names = definedEntries(rules).map(([n]) => n)
    const kept = names.filter(isTypeName)
    /** @type {readonly (readonly [string, string])[]} */
    let result = []
    let i = 0
    for (const name of names) {
        if (isTypeName(name)) {
            result = [...result, [name, name]]
            continue
        }
        let id = `T${i}`
        while (kept.some(k => k === id)) {
            ++i
            id = `T${i}`
        }
        ++i
        result = [...result, [name, id]]
    }
    return result
}

/**
 * A reference prints as its definition's identifier; a reference naming a
 * missing definition is malformed data and panics.
 *
 * @type {(ctx: _Ctx) => (n: Node) => string}
 */
const nodeToTs = ctx => n =>
    typeof n === 'string'
        ? assertNotNullish(assoc(n)(ctx.ids), `missing definition: ${n}`)
        : unionToTs(ctx)(n)

/**
 * A tuple prints its prefix, an array its element type, and a
 * tuple-with-rest combines them with a rest element:
 * `readonly[A,...readonly(R|undefined)[]]`.
 *
 * A position the array may simply end before prints optional — the trailing
 * run whose sets admit **absence**, which is exactly what the array may stop
 * at, arrays being contiguous. It mirrors the optional key `objectSetToTs`
 * prints, with the absent bit stripped from what it prints (`unionToTs`
 * masks it), so `[1, or(option, number)]` prints `readonly[1,(number)?]` —
 * exact under `exactOptionalPropertyTypes`. An *interior* position admitting
 * absence prints `undefined | T` instead ({@link interiorToTs}): TypeScript
 * forbids a required element after an optional one, and `undefined` is what
 * reading a hole gives.
 *
 * The **tail** admits `undefined` on top of what the `rest` states, because a
 * hole past the prefix is no member: the readers check each present member
 * against the `rest` and skip an absent one, so `rest([42], string)` accepts
 * `[42, , ]` and index 1 reads `undefined`. `Ts<>` renders the same tail for
 * the same reason (see `RestTs` in `./types.ts`). The open case pays nothing —
 * `unknown` already admits `undefined` — and an empty rest never reaches here,
 * the data form having normalized it away into the exact-length pattern.
 *
 * A pattern with **no prefix** is the uniform array, which `Ts<>` renders as
 * `ArrayTs` — `readonly Ts<R>[]` — and this mirrors. A hole is no member there
 * either, so that rendering has the same gap one element wider; it is
 * `ArrayTs`'s to close, not this printer's, and closing it here alone would
 * put the two renderers at odds on the commonest schema there is.
 *
 * @type {(ctx: _Ctx) => (p: ArraySet) => string}
 */
const arraySetToTs = ctx => p => {
    const required = requiredPrefix(ctx.rules)(p.prefix)
    const items = p.prefix.map((n, i) =>
        i < required ? interiorToTs(ctx)(n) : `(${nodeToTs(ctx)(n)})?`)
    const { rest } = p
    if (rest === undefined) { return ctx.ts.tuple(items) }
    const restTs = nodeToTs(ctx)(rest)
    if (items.length === 0) { return ctx.ts.array(restTs) }
    const tail = ctx.ts.array(admitsUndefined(ctx)(rest)
        ? restTs
        : union(dedup([primitive(undefined), restTs])))
    return ctx.ts.tuple([...items, `...${tail}`])
}

/**
 * The node's own union, read through a reference (own-property only) if
 * needed.
 *
 * @type {(ctx: _Ctx) => (n: Node) => UnionSet}
 */
const resolveNode = ctx => resolve(ctx.rules)

/**
 * Whether the node's value set admits `undefined` — its unit bit. Still the
 * tail's question (`rest([42], string)` accepts `[42, , ]`, and index 1
 * reads `undefined`); optionality of a declared member is
 * {@link admitsAbsence}'s.
 *
 * @type {(ctx: _Ctx) => (n: Node) => boolean}
 */
const admitsUndefined = ctx => n =>
    ((resolveNode(ctx)(n).unit ?? 0) & undefinedBit) !== 0

/**
 * Whether the node's set admits **absence** — its absent bit, read through a
 * reference if needed. What decides a declared member's optionality.
 *
 * @type {(ctx: _Ctx) => (n: Node) => boolean}
 */
const admitsAbsence = ctx => dataAdmitsAbsence(ctx.rules)

/**
 * An **interior** tuple position: one that admits absence prints
 * `undefined | T` — TypeScript forbids an optional element before a required
 * one, and `undefined` is what reading a hole gives — and any other prints
 * as it is. An inline node converts by bit, so the `undefined` merges into
 * the union's canonical order; a reference prints its identifier with
 * `undefined` unioned in front.
 *
 * @type {(ctx: _Ctx) => (n: Node) => string}
 */
const interiorToTs = ctx => n => {
    const bits = resolveNode(ctx)(n).unit ?? 0
    if ((bits & absentBit) === 0) { return nodeToTs(ctx)(n) }
    if (typeof n === 'string') {
        return union([primitive(undefined), nodeToTs(ctx)(n)])
    }
    return unionToTs(ctx)({ ...n, unit: (bits & ~absentBit) | undefinedBit })
}

/**
 * Whether the node's value set is empty, read through a reference if needed —
 * the data `isNever` answers `false` for a reference without reading it.
 *
 * @type {(ctx: _Ctx) => (n: Node) => boolean}
 */
const isNever = ctx => n => dataIsNever(resolveNode(ctx)(n))

/**
 * A struct prints its fields — a key whose value set admits **absence**
 * prints optional, with the absent bit stripped from what it prints
 * (`unionToTs` masks it), mirroring `Ts<>`: `or(option, number)` is
 * `readonly a?: number`, and `or(number, undefined)` is the required
 * `readonly a: undefined|number` — and a record prints its value type. A props-with-rest set combines them with an
 * intersection; TypeScript requires an index signature to cover the
 * declared keys too, so the index type widens to the union of the rest and
 * the declared value types — the closest expressible supertype.
 *
 * An **empty** rest — what a bare, closed struct carries — prints as the
 * fields alone. TypeScript object types are structurally open, so "and no
 * other key" has no spelling there and the index signature would say the
 * opposite of what is meant; the fields are the closest expressible
 * supertype, exactly as `Ts<>` renders them.
 *
 * @type {(ctx: _Ctx) => (p: ObjectSet) => string}
 */
const objectSetToTs = ctx => p => {
    /** @type {readonly StructField[]} */
    const fields = definedEntries(p.props).map(([k, v]) => {
        const ts = nodeToTs(ctx)(v)
        return admitsAbsence(ctx)(v) ? [k, ts, true] : [k, ts]
    })
    const { rest } = p
    if (rest === undefined || isNever(ctx)(rest)) { return ctx.ts.struct(fields) }
    const restTs = ctx.ts.record(union(dedup([...fields.map(([, v]) => v), nodeToTs(ctx)(rest)])))
    return fields.length === 0 ? restTs : `${ctx.ts.struct(fields)}&${restTs}`
}

/**
 * The TypeScript leaves of a union. A unit's name is already its TypeScript
 * spelling. A whole kind is its type name, except arrays and objects, which
 * print as `unknown` containers.
 *
 * @type {(ctx: _Ctx) => UnionAlgebra<string>}
 */
const tsAlgebra = ctx => ({
    top: 'unknown',
    unit: name => name,
    whole: kind =>
        kind === 'array' ? ctx.ts.array('unknown')
        : kind === 'object' ? ctx.ts.record('unknown')
        : kind,
    number: primitive,
    string: primitive,
    bigint: primitive,
    array: arraySetToTs(ctx),
    object: objectSetToTs(ctx),
    join: union,
})

/**
 * The absent bit is **masked** before printing, by `unionFold`: absence is
 * not a value, so it contributes no union member — `or(option, number)`
 * prints `number`, `option` alone prints `never`, and `or(option, unknown)`
 * prints `unknown` — which is the public `Ts<>` of the same node. Where the
 * bit changes what a position *prints*, the position asks first: an optional
 * key or trailing position strips it by printing through this, and an
 * interior tuple position converts it to `undefined` (`interiorToTs`).
 *
 * @type {(ctx: _Ctx) => (u: UnionSet) => string}
 */
const unionToTs = ctx => unionFold(tsAlgebra(ctx))

/**
 * Renders a serializable RTTI {@link Data} (from `toData`) as TypeScript:
 * the rule definitions as sorted `[identifier, expression]` pairs — render
 * each as `type <identifier> = <expression>` — plus the entry expression,
 * which references those identifiers. A schema with no reference cycles has
 * no definitions and the entry expression stands alone.
 *
 * Rule names come from the data form; one that cannot name a type alias —
 * not an identifier, a predefined type name, an ECMAScript reserved word,
 * or a type-operator keyword — gets a deterministic generated identifier
 * (`T0`, `T1`, …). A reference naming a missing definition panics.
 *
 * @example
 * ```js
 * const list = () => ['array', list]
 * dataToTs()(toData(list))
 * // [[['list', 'readonly(list)[]']], 'list']
 * // i.e. `type list = readonly(list)[]` and the entry expression `list`
 * ```
 *
 * @type {(mut?: true) => (data: Data) => readonly [readonly (readonly [string, string])[], string]}
 */
export const dataToTs = mut => ([rules, entry]) => {
    /** @type {_Ctx} */
    const ctx = { ts: tsPrinter(mut), ids: identifiers(rules), rules }
    return [
        definedEntries(rules).map(([n, u]) =>
            /** @type {const} */ ([nodeToTs(ctx)(n), unionToTs(ctx)(u)])),
        nodeToTs(ctx)(entry),
    ]
}

/**
 * Creates a printer that converts an RTTI schema `Type` to its TypeScript
 * type expression as a string, through the canonical data form: `toData`
 * first, then {@link dataToTs}.
 *
 * Mirrors the compile-time `Ts<T>` mapped type at runtime, in the data
 * form's canonical order — union members follow its kind order (e.g.
 * `or(number, undefined)` prints `'undefined|number'`) and structurally
 * different but equivalent schemas print identically (`or(true, false)`
 * prints `'boolean'`). Absence is not a value, so `or(option, number)`
 * prints `'number'` — the public `Ts<>` of the same schema; where it lands
 * on a declared member, the member prints optional instead. Pass `true` to
 * emit mutable (non-`readonly`) types.
 *
 * A recursive schema prints as the identifier of its definition — use
 * {@link dataToTs} to also obtain the `type <identifier> = <expression>`
 * definitions the expression references; a schema with no reference cycles
 * needs none.
 *
 * **Two notes where this and `Ts<>` differ.** The `unknown` schema produces
 * the string `'unknown'` (TypeScript's built-in), whereas `Ts<>` maps it to
 * rtti's own `Unknown` from [`./types.ts`](./types.ts), which coincides
 * with DataJS's without being it. And this printer recognizes an empty
 * rest **semantically** — the data form has already normalized one away — so
 * `rest([42], [or()])` prints the exact `readonly[42]`, where `Ts<>` keeps a
 * tail it cannot see through (`RestTs` in `./types.ts` says why, and in which
 * direction). Both print the same thing for every rest a schema states
 * directly.
 *
 * @example
 * ```js
 * const toTs = printer()
 * toTs(boolean)                    // 'boolean'
 * toTs(array(number))              // 'readonly(number)[]'
 * toTs(record(string))             // '{readonly[k in string]?:string}'
 * toTs(or(string, number))         // 'number|string'
 * toTs(42)                         // '42'
 * toTs('hello')                    // '"hello"'
 * toTs([boolean, number])          // 'readonly[boolean,number]'
 * toTs(open([boolean, number]))    // 'readonly[boolean,number,...readonly(unknown)[]]'
 * toTs({ x: string })              // '{readonly"x":string}'
 *
 * const list = () => ['array', list]
 * toTs(list)                       // 'list' — see `dataToTs` for the definition
 *
 * const toTsMut = printer(true)
 * toTsMut(array(number))           // '(number)[]'
 * toTsMut(record(string))          // '{[k in string]?:string}'
 * ```
 *
 * @type {(mut?: true) => (rtti: Type) => string}
 */
export const printer = mut => {
    const toTs = dataToTs(mut)
    return rtti => {
        const [, entry] = toTs(toData(rtti))
        return entry
    }
}
