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
 * | `bigint` | `Vec<u8>`: it is a `Vec`, the bits of a file, in whole bytes |
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
 * @import { Type } from '../../../rtti/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { error, ok, okList } from '../../../types/result/module.f.mjs'
import {
    dirent, fileModule, ioChannel, ioError, makeDirectoryOptions, notImplemented, operations,
    readdirOptions, writeConsoles,
} from '../module.f.mjs'

/** @typedef {Result<string, readonly unknown[]>} _Printed */

/**
 * What follows a step that may have failed: its result, or its failure.
 *
 * It is not called `then`: a module that exports `then` is thenable, and
 * `await import(…)` of it never settles.
 *
 * @type {<A, B>(f: (a: A) => Result<B, readonly unknown[]>) => (r: Result<A, readonly unknown[]>) => Result<B, readonly unknown[]>}
 */
export const bind = f => r => r[0] === 'error' ? r : f(r[1])

/**
 * Every result, or the first failure.
 *
 * @type {<A>(list: readonly Result<A, readonly unknown[]>[]) => Result<readonly A[], readonly unknown[]>}
 */
export const all = list => okList(list)

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
export const nameOf = t => types.find(([, s]) => s === t)?.[0]

const isUpper = (/** @type {string} */ c) => c >= 'A' && c <= 'Z'

/**
 * `camelCase` or `PascalCase` as `snake_case`.
 *
 * @type {(s: string) => string}
 */
export const snake = s => [...s].map((c, i) => isUpper(c) ? `${i === 0 ? '' : '_'}${c.toLowerCase()}` : c).join('')

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
export const members = t => {
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
export const optional = t => {
    const ms = members(t)
    return ms !== undefined && ms.some(isOption)
        ? ms.filter(m => !isOption(m) && m !== undefined)
        : undefined
}

/** @type {(t: unknown, what: string) => Result<never, readonly unknown[]>} */
export const refuse = (t, what) => error([what, t])

/**
 * The Rust type of a schema.
 *
 * @type {(t: unknown) => _Printed}
 */
export const rustType = t => {
    const name = nameOf(t)
    if (name !== undefined) { return ok(name) }
    if (t === undefined) { return ok('()') }
    if (typeof t !== 'function') { return refuse(t, 'no Rust type for a constant or an unnamed container') }
    const info = t()
    switch (info[0]) {
        case 'string': return ok('String')
        case 'number': return ok('f64')
        case 'boolean': return ok('bool')
        case 'bigint': return ok('Vec<u8>')
        case 'array': return bind(e => ok(`Vec<${e}>`))(rustType(info[1]))
        case 'or': return unionType(info.slice(1))
        default: return refuse(t, 'no Rust type for a schema')
    }
}

/**
 * The Rust type of an unnamed union: a nothing, an `Option`, or a `Result`.
 *
 * @type {(ms: readonly unknown[]) => _Printed}
 */
const unionType = ms => {
    if (ms.length === 1 && ms[0] === undefined) { return ok('()') }
    if (ms.length === 2 && ms.includes(null)) {
        return bind(t => ok(`Option<${t}>`))(rustType(ms.find(m => m !== null)))
    }
    const [a, b] = /** @type {readonly any[]} */ (ms)
    if (ms.length === 2 && tag(a) === 'ok' && tag(b) === 'error') {
        return bind(t => bind(e => ok(`Result<${t}, ${e}>`))(rustType(b[1])))(rustType(a[1]))
    }
    return refuse(ms, 'no Rust type for a union')
}

/**
 * The tag of a tagged tuple, `['tag', …]`, or `undefined`.
 *
 * @type {(t: unknown) => string | undefined}
 */
export const tag = t => Array.isArray(t) && typeof t[0] === 'string' ? t[0] : undefined

/**
 * A struct member as its Rust field, `pub name: type`. A member that may
 * be absent is an `Option`, and a flag, `or(option, true)`, a `bool`. A
 * member that is always one value, `recursive: true`, carries nothing and
 * has no field.
 *
 * @type {(entry: readonly [string, unknown]) => Result<readonly string[], readonly unknown[]>}
 */
const field = ([key, t]) => {
    if (typeof t !== 'function') { return ok([]) }
    const rest = optional(t)
    if (rest === undefined) { return bind(r => ok([`    pub ${snake(key)}: ${r},`]))(rustType(t)) }
    if (rest.length !== 1) { return refuse(t, 'no Rust type for an optional member of several types') }
    if (rest[0] === true) { return ok([`    pub ${snake(key)}: bool,`]) }
    return bind(r => ok([`    pub ${snake(key)}: Option<${r}>,`]))(rustType(rest[0]))
}

const derive = '#[derive(Debug, Clone, PartialEq)]'

/**
 * A named struct schema as a Rust struct: its members as fields, and a unit
 * struct where none carries anything.
 *
 * @type {(name: string, s: { readonly [k in string]: unknown }) => Result<string, readonly unknown[]>}
 */
const struct = (name, s) => bind(
    (/** @type {readonly (readonly string[])[]} */ fs) => {
        const lines = fs.flat()
        return ok(lines.length === 0
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
 * @type {(m: unknown) => _Printed}
 */
const variant = m => {
    const t = tag(m)
    if (t === undefined) { return refuse(m, 'no Rust variant for a schema that is not a tagged tuple') }
    return bind(
        (/** @type {readonly string[]} */ fs) => ok(fs.length === 0 ? `    ${pascal(t)},` : `    ${pascal(t)}(${fs.join(', ')}),`))(
        all(/** @type {readonly unknown[]} */ (m).slice(1).map(rustType)))
}

/**
 * A named union of tagged tuples as an enum.
 *
 * @type {(name: string, ms: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const taggedEnum = (name, ms) => bind(
    (/** @type {readonly string[]} */ vs) => ok(`${derive}\npub enum ${name} {\n${vs.join('\n')}\n}\n`))(
    all(ms.map(variant)))

/**
 * A named tagged tuple as a tuple struct over the members after its tag.
 *
 * @type {(name: string, fields: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const tupleStruct = (name, fields) => bind(
    (/** @type {readonly string[]} */ fs) => ok(`${derive}\npub struct ${name}(${fs.map(f => `pub ${f}`).join(', ')});\n`))(
    all(fields.map(rustType)))

/**
 * A named schema's Rust definition.
 *
 * @type {(entry: readonly [string, unknown]) => Result<string, readonly unknown[]>}
 */
export const definition = ([name, t]) => {
    if (tag(t) !== undefined) { return tupleStruct(name, /** @type {readonly unknown[]} */ (t).slice(1)) }
    const ms = members(t)
    if (ms === undefined) { return struct(name, /** @type {{ readonly [k in string]: unknown }} */ (t)) }
    return typeof ms[0] === 'string' ? ok(unitEnum(name, ms)) : taggedEnum(name, ms)
}

/**
 * A parameter as Rust takes it: `name: type`, nothing for one that is
 * always the same constant (`read`'s stream), an `Option` for one that may
 * be absent.
 *
 * @type {(name: string, t: unknown) => Result<readonly string[], readonly unknown[]>}
 */
const parameter = (name, t) => {
    if (typeof t !== 'function' && t !== undefined && nameOf(t) === undefined) { return ok([]) }
    const rest = optional(t)
    return bind(r => ok([`${snake(name)}: ${rest === undefined ? r : `Option<${r}>`}`]))(
        rustType(rest === undefined ? t : rest[0]))
}

/**
 * An operation as a trait method.
 *
 * @type {(o: { readonly name: string, readonly params: readonly unknown[], readonly answer: unknown, readonly names: readonly string[] }) => Result<string, readonly unknown[]>}
 */
export const method = ({ name, params, answer, names }) => bind(
    (/** @type {readonly (readonly string[])[]} */ ps) => bind(
        (/** @type {string} */ r) => ok(`    fn ${snake(name)}(${['&mut self', ...ps.flat()].join(', ')}) -> ${r};`))(
        rustType(answer)))(
    all(params.map((t, i) => parameter(names[i], t))))

const header = `// @generated by \`npm run gen\` from \`fjs/effects/schema/rust/module.f.mjs\`.
// Do not edit: change the schemas in \`fjs/effects/schema/module.f.mjs\` and regenerate.
`

/**
 * The generated Rust file: the named types, then the trait.
 *
 * @type {() => Result<string, readonly unknown[]>}
 */
export const generate = () => bind(
    (/** @type {readonly string[]} */ defs) => bind(
        (/** @type {readonly string[]} */ ms) => ok([
            header,
            ...defs,
            `/// One method per operation, in the order the schemas list them.\n#[rustfmt::skip]\npub trait Operations {\n${ms.join('\n')}\n}\n`,
        ].join('\n')))(
        all(Object.values(operations).map(method))))(
    all(types.map(definition)))
