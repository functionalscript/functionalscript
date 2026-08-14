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
 * @import { Printer } from '../../ts/types.ts'
 * @import { Type } from '../types.ts'
 * @import { ArraySet, Data, KindSet, Node, ObjectSet, RuleSet, UnionSet } from '../data/types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { definedEntries } from '../../object/module.f.mjs'
import { primitive, union, printer as tsPrinter } from '../../ts/module.f.mjs'
import { cmp, toData, unitBit, unknown as top } from '../data/module.f.mjs'

const nullBit = unitBit(null)
const undefinedBit = unitBit(undefined)
const falseBit = unitBit(false)
const trueBit = unitBit(true)
const booleanBits = falseBit | trueBit

/**
 * Names that cannot name a TypeScript type alias: the predefined type
 * names (`TS2457`), the ECMAScript reserved words, and the type-operator
 * keywords that fail to parse in the alias-name position.
 */
const reserved = /** @type {const} */ ([
    // predefined type names
    'any', 'bigint', 'boolean', 'false', 'never', 'null', 'number', 'object',
    'string', 'symbol', 'true', 'undefined', 'unknown', 'void',
    // ECMAScript reserved words
    'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
    'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
    'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
    'typeof', 'var', 'while', 'with',
    // type-operator keywords
    'infer', 'keyof', 'readonly', 'unique',
])

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

/** @typedef {{ readonly ts: Printer, readonly ids: readonly (readonly [string, string])[] }} _Ctx */

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
 * `readonly[A,...readonly(R)[]]`.
 *
 * @type {(ctx: _Ctx) => (p: ArraySet) => string}
 */
const arraySetToTs = ctx => p => {
    const items = p.prefix.map(nodeToTs(ctx))
    const { rest } = p
    if (rest === undefined) { return ctx.ts.tuple(items) }
    const restTs = ctx.ts.array(nodeToTs(ctx)(rest))
    return items.length === 0 ? restTs : ctx.ts.tuple([...items, `...${restTs}`])
}

/**
 * A struct prints its fields, a record its value type, and a
 * props-with-rest combines them with an intersection.
 *
 * @type {(ctx: _Ctx) => (p: ObjectSet) => string}
 */
const objectSetToTs = ctx => p => {
    const fields = definedEntries(p.props).map(
        ([k, v]) => /** @type {const} */ ([k, nodeToTs(ctx)(v)]))
    const { rest } = p
    if (rest === undefined) { return ctx.ts.struct(fields) }
    const restTs = ctx.ts.record(nodeToTs(ctx)(rest))
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
    const ctx = { ts: tsPrinter(mut), ids: identifiers(rules) }
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
 * **Note:** the `unknown` schema produces the string `'unknown'`
 * (TypeScript's built-in), whereas `Ts<>` maps it to `DjsUnknown` from
 * `djs/module.f.ts`.
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
