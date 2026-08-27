/**
 * Runtime printer mirroring the `Ts<T>` type transformer for RTTI schemas.
 * See `./types.ts` for `Ts<T>` and the `*Ts` transformer types.
 *
 * The printer routes through the serializable RTTI data form
 * (`fjs/types/rtti/data`): `thunk RTTI → toData → dataToTs`. The data form
 * is a finite graph, so recursive schemas — which the thunk graph represents
 * as self-referencing functions with no leaves — terminate: every named rule
 * becomes a TypeScript type-alias definition and every graph edge prints as
 * that alias's identifier. Output is canonical: union members follow the
 * data form's kind order and object keys its sorted order, so structurally
 * different but equivalent schemas print identically.
 *
 * @module
 *
 * @import { Printer, StructField } from '../../ts/types.ts'
 * @import { Type } from '../../../rtti/types.ts'
 * @import { ArraySet, Data, KindSet, Node, ObjectSet, RuleSet, UnionSet } from '../data/types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { reservedWords, strictModeReservedWords } from '../../../js/keywords/module.f.mjs'
import { at, definedEntries } from '../../object/module.f.mjs'
import { primitive, union, printer as tsPrinter } from '../../ts/module.f.mjs'
import { cmp, never as bottom, toData, unitBit, unknown as top } from '../data/module.f.mjs'

const nullBit = unitBit(null)
const undefinedBit = unitBit(undefined)
const falseBit = unitBit(false)
const trueBit = unitBit(true)
const booleanBits = falseBit | trueBit

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
 * @typedef {{
 *  readonly ts: Printer
 *  readonly ids: readonly (readonly [string, string])[]
 *  readonly rules: RuleSet
 * }} _Ctx
 */

/** @type {(ids: readonly (readonly [string, string])[], name: string) => string | undefined} */
const idOf = (ids, name) => {
    for (const [k, v] of ids) {
        if (k === name) { return v }
    }
    return undefined
}

/**
 * A reference prints as its definition's identifier; a reference naming a
 * missing definition is malformed data and panics.
 *
 * @type {(ctx: _Ctx) => (n: Node) => string}
 */
const nodeToTs = ctx => n =>
    typeof n === 'string'
        ? assertNotNullish(idOf(ctx.ids, n), `missing definition: ${n}`)
        : unionToTs(ctx)(n)

/**
 * The member expressions of one kind component: nothing when absent, the
 * whole kind when `true`, one expression per member otherwise.
 *
 * @template T
 * @param {KindSet<T> | undefined} k
 * @param {string} whole
 * @param {(v: T) => string} item
 * @returns {readonly string[]}
 */
const kindToTs = (k, whole, item) =>
    k === undefined ? [] :
    k === true ? [whole] :
    k.map(item)

/** @type {(bits: number) => readonly string[]} */
const unitToTs = bits => [
    ...((bits & nullBit) === 0 ? [] : [primitive(null)]),
    ...((bits & undefinedBit) === 0 ? [] : [primitive(undefined)]),
    ...((bits & booleanBits) === booleanBits ? ['boolean']
        : (bits & falseBit) !== 0 ? [primitive(false)]
        : (bits & trueBit) !== 0 ? [primitive(true)]
        : []),
]

/**
 * A tuple prints its prefix, an array its element type, and a
 * tuple-with-rest combines them with a rest element:
 * `readonly[A,...readonly(R|undefined)[]]`.
 *
 * A position the array may simply end before prints optional — the trailing
 * run whose sets admit `undefined`, which is exactly what the array may stop
 * at, arrays being contiguous. It mirrors the optional key `objectSetToTs`
 * prints, and keeps the union rather than stripping `undefined` from it, as
 * that one does.
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
    const required = p.prefix.findLastIndex(n => !admitsUndefined(ctx)(n)) + 1
    const items = p.prefix.map((n, i) => {
        const ts = nodeToTs(ctx)(n)
        return i < required ? ts : `(${ts})?`
    })
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
const resolveNode = ctx => n =>
    typeof n === 'string' ? assertNotNullish(at(n)(ctx.rules)) : n

/**
 * Whether the node's value set admits `undefined` — its unit bit.
 *
 * @type {(ctx: _Ctx) => (n: Node) => boolean}
 */
const admitsUndefined = ctx => n =>
    ((resolveNode(ctx)(n).unit ?? 0) & undefinedBit) !== 0

/**
 * Whether the node's value set is empty.
 *
 * @type {(ctx: _Ctx) => (n: Node) => boolean}
 */
const isNever = ctx => n => cmp([{}, resolveNode(ctx)(n)])([{}, bottom]) === 0

/** @type {(list: readonly string[]) => readonly string[]} */
const dedup = list => list.filter((s, i) => list.indexOf(s) === i)

/**
 * A struct prints its fields — a key whose value set admits `undefined` may
 * also be absent, so it prints optional, mirroring `Ts<>` — and a record
 * prints its value type. A props-with-rest set combines them with an
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
        return admitsUndefined(ctx)(v) ? [k, ts, true] : [k, ts]
    })
    const { rest } = p
    if (rest === undefined || isNever(ctx)(rest)) { return ctx.ts.struct(fields) }
    const restTs = ctx.ts.record(union(dedup([...fields.map(([, v]) => v), nodeToTs(ctx)(rest)])))
    return fields.length === 0 ? restTs : `${ctx.ts.struct(fields)}&${restTs}`
}

/** @type {(u: UnionSet) => boolean} */
const isTop = u => cmp([{}, u])([{}, top]) === 0

/** @type {(ctx: _Ctx) => (u: UnionSet) => string} */
const unionToTs = ctx => u => {
    if (isTop(u)) { return 'unknown' }
    return union([
        ...unitToTs(u.unit ?? 0),
        ...kindToTs(u.number, 'number', primitive),
        ...kindToTs(u.string, 'string', primitive),
        ...kindToTs(u.bigint, 'bigint', primitive),
        ...kindToTs(u.array, ctx.ts.array('unknown'), arraySetToTs(ctx)),
        ...kindToTs(u.object, ctx.ts.record('unknown'), objectSetToTs(ctx)),
    ])
}

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
 * `option(number)` prints `'undefined|number'`) and structurally different
 * but equivalent schemas print identically (`or(true, false)` prints
 * `'boolean'`). Pass `true` to emit mutable (non-`readonly`) types.
 *
 * A recursive schema prints as the identifier of its definition — use
 * {@link dataToTs} to also obtain the `type <identifier> = <expression>`
 * definitions the expression references; a schema with no reference cycles
 * needs none.
 *
 * **Two notes where this and `Ts<>` differ.** The `unknown` schema produces
 * the string `'unknown'` (TypeScript's built-in), whereas `Ts<>` maps it to
 * `DjsUnknown` from `djs/module.f.ts`. And this printer recognizes an empty
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
