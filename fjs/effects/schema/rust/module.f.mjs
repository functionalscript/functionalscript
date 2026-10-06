/**
 * Prints the schemas of [`../module.f.mjs`](../module.f.mjs) as Rust: the
 * types of the operations' requests and results, and a trait with one method
 * per operation, which `nanvm-effects-node`'s runner implements, so that rustc
 * checks its coverage and signatures against the schemas
 * ([`todo/nanvm-effects-node.md`](../../../../todo/nanvm-effects-node.md)).
 *
 * The printer reads the schemas themselves, not their data form, because the
 * data form drops what it needs: which struct is `Dirent` and which parameter
 * is `path` are facts of the declarations, not of the sets of values. It
 * covers the vocabulary the operations use and refuses every other schema,
 * with the schema in the error, rather than print a guess:
 *
 * | Schema | Rust |
 * | --- | --- |
 * | `string`, `number`, `boolean` | `String`, `f64`, `bool` |
 * | `bigint` | `BigInt<A>` of `nanvm_lib::vm`: it holds any `Vec` exactly; refused inside a struct, enum or tuple struct, which are not generic over `A` |
 * | `array(t)` | `Vec<t>` |
 * | `or(null, t)` | `Option<t>` |
 * | `or(['ok', t], ['error', e])` | `Result<t, e>` |
 * | `or(undefined)` | `()` |
 * | a named struct | a struct, its members in `snake_case` |
 * | a named tagged tuple | a tuple struct over what follows the tag |
 * | a named `or` of strings | a unit enum |
 * | a named `or` of tagged tuples | an enum, one variant per tag |
 *
 * A struct member or a trailing parameter that may be absent, `or(option, t)`,
 * is an `Option<t>`, and an `or(option, true)` flag is a `bool`.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 */

import { error, ok, okList, okThen } from '../../../types/result/module.f.mjs'
import {
    dirent, fileModule, ioChannel, ioError, makeDirectoryOptions, notImplemented, operations,
    readdirOptions, writeConsoles,
} from '../module.f.mjs'

/**
 * A success whose failure is the printer's, a reason and the schema.
 *
 * @type {<T>(value: T) => Result<T, readonly unknown[]>}
 */
const pure = ok

/**
 * Every result, or the first failure.
 *
 * @type {<A>(list: readonly Result<A, readonly unknown[]>[]) => Result<readonly A[], readonly unknown[]>}
 */
const all = okList

/**
 * The named types of the schemas, in the order they are declared: the name
 * Rust gives the schema, which is told apart by identity.
 *
 * @type {readonly (readonly [string, unknown])[]}
 */
export const types = [
    ['NotImplemented', notImplemented],
    ['IoErrorInfo', ioError[1]],
    ['IoChannel', ioChannel],
    ['MakeDirectoryOptions', makeDirectoryOptions],
    ['FileModule', fileModule],
    ['ReaddirOptions', readdirOptions],
    ['Dirent', dirent],
    ['WriteConsoles', writeConsoles],
]

/**
 * The name of a schema that has one, or `undefined`.
 *
 * @type {(t: unknown) => string | undefined}
 */
const nameOf = t => types.find(([, s]) => s === t)?.[0]

const isUpper = (/** @type {string} */ c) => c >= 'A' && c <= 'Z'

/**
 * `camelCase` as `snake_case`.
 *
 * @type {(s: string) => string}
 */
export const snake = s => [...s].map(c => isUpper(c) ? `_${c.toLowerCase()}` : c).join('')

/**
 * `camelCase` as `PascalCase`.
 *
 * @type {(s: string) => string}
 */
export const pascal = s => `${s[0].toUpperCase()}${s.slice(1)}`

/**
 * The members of a union, or `undefined` for a schema that is not one.
 *
 * @type {(t: unknown) => readonly unknown[] | undefined}
 */
const members = t => {
    if (typeof t !== 'function') { return undefined }
    const info = t()
    return info[0] === 'or' ? info.slice(1) : undefined
}

/** @type {(t: unknown) => boolean} */
const isOption = t => typeof t === 'function' && t()[0] === 'option'

/**
 * The type a member that may be absent holds, `or(option, t)` and
 * `or(option, t, undefined)`, as the schemas that remain, or `undefined` for
 * a member that is required.
 *
 * @type {(t: unknown) => readonly unknown[] | undefined}
 */
const optional = t => {
    const ms = members(t)
    return ms !== undefined && ms.some(isOption)
        ? ms.filter(m => !isOption(m) && m !== undefined)
        : undefined
}

/** @type {(t: unknown, what: string) => Result<never, readonly unknown[]>} */
const refuse = (t, what) => error([what, t])

/**
 * The Rust type of a schema, with `bigint` as `BigInt<A>` where `bigint` is
 * `true`, and refused where it is `false`: a struct is not generic over `A`.
 *
 * @type {(bigint: boolean) => (t: unknown) => Result<string, readonly unknown[]>}
 */
const typeOf = bigint => {
    /** @type {(t: unknown) => Result<string, readonly unknown[]>} */
    const rec = t => {
        const name = nameOf(t)
        if (name !== undefined) { return pure(name) }
        if (t === undefined) { return pure('()') }
        if (typeof t !== 'function') { return refuse(t, 'no Rust type for a constant or an unnamed container') }
        const info = t()
        switch (info[0]) {
            case 'string': return pure('String')
            case 'number': return pure('f64')
            case 'boolean': return pure('bool')
            case 'bigint': return bigint ? pure('BigInt<A>') : refuse(t, 'no Rust type for a bigint in a type that is not generic')
            case 'array': return okThen(e => pure(`Vec<${e}>`))(rec(info[1]))
            case 'or': return unionType(rec)(info.slice(1))
            default: return refuse(t, 'no Rust type for a schema')
        }
    }
    return rec
}

/**
 * The Rust type of a schema, where it is a parameter or a result.
 *
 * @type {(t: unknown) => Result<string, readonly unknown[]>}
 */
export const rustType = typeOf(true)

/**
 * The Rust type of a schema, where it is held by a struct or an enum.
 *
 * @type {(t: unknown) => Result<string, readonly unknown[]>}
 */
export const dataType = typeOf(false)

/**
 * The Rust type of an unnamed union: a nothing, an `Option`, or a `Result`.
 *
 * @type {(rec: (t: unknown) => Result<string, readonly unknown[]>) => (ms: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const unionType = rec => ms => {
    if (ms.length === 1 && ms[0] === undefined) { return pure('()') }
    if (ms.length === 2 && ms.includes(null)) {
        const some = ms.find(m => m !== null)
        return some === undefined
            ? refuse(ms, 'no Rust type for an Option of nothing')
            : okThen(t => pure(`Option<${t}>`))(rec(some))
    }
    const [a, b] = /** @type {readonly any[]} */ (ms)
    if (ms.length === 2 && tag(a) === 'ok' && tag(b) === 'error' && a.length === 2 && b.length === 2) {
        return okThen(t => okThen(e => pure(`Result<${t}, ${e}>`))(rec(b[1])))(rec(a[1]))
    }
    return refuse(ms, 'no Rust type for a union')
}

/**
 * The tag of a tagged tuple, `['tag', …]`, or `undefined`.
 *
 * @type {(t: unknown) => string | undefined}
 */
const tag = t => t instanceof Array && typeof t[0] === 'string' ? t[0] : undefined

/**
 * A struct member as its Rust field, `pub name: type`. A member that may
 * be absent is an `Option`, and a flag, `or(option, true)`, a `bool`. A
 * member that is a constant, `recursive: true`, carries nothing and has no
 * field; every other schema is typed or refused.
 *
 * @type {(entry: readonly [string, unknown]) => Result<readonly string[], readonly unknown[]>}
 */
const field = ([key, t]) => {
    if (isConstant(t)) { return pure([]) }
    const rest = optional(t)
    if (rest === undefined) { return okThen(r => pure([`    pub ${snake(key)}: ${r},`]))(dataType(t)) }
    if (rest.length !== 1) { return refuse(t, 'no Rust type for an optional member of several types') }
    if (rest[0] === true) { return pure([`    pub ${snake(key)}: bool,`]) }
    return okThen(r => pure([`    pub ${snake(key)}: Option<${r}>,`]))(dataType(rest[0]))
}

/**
 * A schema that is a constant: always the same value, so it carries nothing.
 *
 * @type {(t: unknown) => boolean}
 */
const isConstant = t => t === null || typeof t === 'string' || typeof t === 'number' || typeof t === 'boolean'

const derive = '#[derive(Debug, Clone, PartialEq)]'

/**
 * A named struct schema as a Rust struct: its members as fields, and a unit
 * struct where none carries anything.
 *
 * @type {(name: string, s: { readonly [k in string]: unknown }) => Result<string, readonly unknown[]>}
 */
const struct = (name, s) => okThen(
    (/** @type {readonly (readonly string[])[]} */ fs) => {
        const lines = fs.flat()
        return pure(lines.length === 0
            ? `${derive}\npub struct ${name};\n`
            : `${derive}\npub struct ${name} {\n${lines.join('\n')}\n}\n`)
    })(all(Object.entries(s).map(field)))

/**
 * A named union of constant strings as a unit enum.
 *
 * @type {(name: string, ms: readonly unknown[]) => string}
 */
const unitEnum = (name, ms) => `${derive}\npub enum ${name} {\n${ms.map(m => `    ${pascal(/** @type {string} */ (m))},`).join('\n')}\n}\n`

/**
 * One variant of an enum over tagged tuples: the tag in `PascalCase`, and
 * what follows it as the variant's fields.
 *
 * @type {(m: unknown) => Result<string, readonly unknown[]>}
 */
const variant = m => {
    const t = tag(m)
    if (t === undefined) { return refuse(m, 'no Rust variant for a schema that is not a tagged tuple') }
    return okThen(
        (/** @type {readonly string[]} */ fs) => pure(fs.length === 0 ? `    ${pascal(t)},` : `    ${pascal(t)}(${fs.join(', ')}),`))(
        all(/** @type {readonly unknown[]} */ (m).slice(1).map(dataType)))
}

/**
 * A named union of tagged tuples as an enum.
 *
 * @type {(name: string, ms: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const taggedEnum = (name, ms) => okThen(
    (/** @type {readonly string[]} */ vs) => pure(`${derive}\npub enum ${name} {\n${vs.join('\n')}\n}\n`))(
    all(ms.map(variant)))

/**
 * A named tagged tuple as a tuple struct over the members after its tag.
 *
 * @type {(name: string, fields: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const tupleStruct = (name, fields) => okThen(
    (/** @type {readonly string[]} */ fs) => pure(`${derive}\npub struct ${name}(${fs.map(f => `pub ${f}`).join(', ')});\n`))(
    all(fields.map(dataType)))

/**
 * A named schema's Rust definition.
 *
 * @type {(entry: readonly [string, unknown]) => Result<string, readonly unknown[]>}
 */
export const definition = ([name, t]) => {
    if (tag(t) !== undefined) { return tupleStruct(name, /** @type {readonly unknown[]} */ (t).slice(1)) }
    const ms = members(t)
    if (ms !== undefined) { return ms.every(m => typeof m === 'string') ? pure(unitEnum(name, ms)) : taggedEnum(name, ms) }
    if (typeof t !== 'object' || t === null || t instanceof Array) {
        return refuse(t, 'no Rust definition for a named schema that is not a struct, an enum or a tuple')
    }
    return struct(name, /** @type {{ readonly [k in string]: unknown }} */ (t))
}

/**
 * A parameter as Rust takes it: `name: type`, nothing for one that is
 * always the same constant (`read`'s stream), an `Option` for one that may
 * be absent. An optional parameter must carry exactly one type after absence
 * and explicit `undefined` are removed; other shapes are refused.
 *
 * @type {(name: string, t: unknown) => Result<readonly string[], readonly unknown[]>}
 */
const parameter = (name, t) => {
    if (isConstant(t)) { return pure([]) }
    const rest = optional(t)
    if (rest !== undefined && rest.length !== 1) {
        return refuse(t, 'no Rust type for an optional parameter without exactly one carried type')
    }
    return okThen(r => pure([`${snake(name)}: ${rest === undefined ? r : `Option<${r}>`}`]))(
        rustType(rest === undefined ? t : rest[0]))
}

/**
 * An operation as a trait method.
 *
 * @type {(o: { readonly name: string, readonly params: readonly unknown[], readonly answer: unknown, readonly names: readonly string[] }) => Result<string, readonly unknown[]>}
 */
export const method = ({ name, params, answer, names }) => okThen(
    (/** @type {readonly (readonly string[])[]} */ ps) => okThen(
        (/** @type {string} */ r) => pure(`    fn ${snake(name)}(${['&mut self', ...ps.flat()].join(', ')}) -> ${r};`))(
        rustType(answer)))(
    all(params.map((t, i) => parameter(names[i], t))))

const header = `// @generated by \`npm run gen\` from \`fjs/effects/schema/rust/module.f.mjs\`.
// Do not edit: change the schemas in \`fjs/effects/schema/module.f.mjs\` and regenerate.

use nanvm_lib::vm::{BigInt, IVm};
`

/**
 * The generated Rust file: the named types, then the trait.
 *
 * @type {() => Result<string, readonly unknown[]>}
 */
export const generate = () => okThen(
    (/** @type {readonly string[]} */ defs) => okThen(
        (/** @type {readonly string[]} */ ms) => pure([
            header,
            ...defs,
            `/// One method per operation, in the order the schemas list them.\n#[rustfmt::skip]\npub trait Operations<A: IVm> {\n${ms.join('\n')}\n}\n`,
        ].join('\n')))(
        all(Object.values(operations).map(method))))(
    all(types.map(definition)))
