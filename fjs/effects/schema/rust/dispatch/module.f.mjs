/**
 * Prints the dispatch of `nanvm-effects-node`: for each operation, reading its
 * request from VM values, calling the [`Operations`](../module.f.mjs) method
 * and writing the answer back, and one `dispatch` over them all, by command
 * name. A schema is read and written the way [`../module.f.mjs`](../module.f.mjs)
 * gave it its Rust type, with the helpers of the crate's handwritten
 * `codec.rs`:
 *
 * | Schema | Reads | Writes |
 * | --- | --- | --- |
 * | `string`, `number`, `boolean` | the same | the same |
 * | `bigint` | a `Vec`'s bytes | a `Vec` |
 * | `array(t)` | each element | each element |
 * | `or(null, t)` | `null` or `t` | `null` or `t` |
 * | `or(option, t)` | left out, `undefined`, or `t` | left out when `None` |
 * | `or(['ok', t], ['error', e])` | refused | `['ok', t]` or `['error', e]` |
 * | `or(undefined)` | refused | `undefined` |
 * | a named struct | a closed object | an object |
 * | a named `or` of strings | one of the strings | the string |
 * | a named `or` of tagged tuples | refused | the tuple |
 * | a named tagged tuple | refused | the tuple |
 *
 * A payload longer than the operation's parameters is refused, as its
 * parameter tuple is closed. Only what a request holds is read, and only what an answer holds is
 * written: a type no request reaches has no reader. Anything the printer has
 * no spelling for is refused, with the schema in the error, as it is there.
 *
 * @module
 *
 * @import { Result } from '../../../../types/result/types.ts'
 */

import { ok } from '../../../../types/result/module.f.mjs'
import { operations } from '../../module.f.mjs'
import { all, members, nameOf, optional, pascal, refuse, snake, tag, bind, types } from '../module.f.mjs'

/** @typedef {Result<string, readonly unknown[]>} _Printed */

/** @typedef {readonly [readonly string[], readonly string[]]} _Member */

/** @typedef {{ readonly name: string, readonly params: readonly unknown[], readonly answer: unknown, readonly names: readonly string[] }} _Operation */

/**
 * A struct member's reader: the statements that check it, and the fields it gives.
 *
 * @type {(checks: readonly string[], fields: readonly string[]) => Result<_Member, readonly unknown[]>}
 */
const memberReader = (checks, fields) => ok([checks, fields])

/**
 * The `Result`'s two sides, or `undefined`.
 *
 * @type {(t: unknown) => readonly [unknown, unknown] | undefined}
 */
const resultOf = t => {
    const ms = members(t)
    return ms !== undefined && ms.length === 2 && tag(ms[0]) === 'ok' && tag(ms[1]) === 'error'
        ? [/** @type {readonly unknown[]} */ (ms[0])[1], /** @type {readonly unknown[]} */ (ms[1])[1]]
        : undefined
}

/**
 * What an `or(null, t)` holds besides `null`, or `undefined`.
 *
 * @type {(t: unknown) => unknown}
 */
const nullableOf = t => {
    const ms = members(t)
    return ms !== undefined && ms.length === 2 && ms.includes(null) ? ms.find(m => m !== null) : undefined
}

/**
 * A schema read or written by a generic helper over its parts, not by a
 * function of its own: `[kind, ...parts]`.
 *
 * @type {(t: unknown) => readonly unknown[] | undefined}
 */
const composite = t => {
    if (nameOf(t) !== undefined || typeof t !== 'function') { return undefined }
    const info = t()
    if (info[0] === 'array') { return ['array', info[1]] }
    if (info[0] !== 'or') { return undefined }
    const r = resultOf(t)
    if (r !== undefined) { return ['result', ...r] }
    const n = nullableOf(t)
    return n === undefined ? undefined : ['nullable', n]
}

/** @type {(t: unknown) => boolean} */
const isNothing = t => t === undefined || (members(t)?.length === 1 && members(t)?.[0] === undefined)

/**
 * The function that reads a schema with nothing to read it by: a name, or a
 * primitive.
 *
 * @type {(t: unknown) => _Printed}
 */
const atomicReader = t => {
    const name = nameOf(t)
    if (name !== undefined) { return ok(`decode_${snake(name)}`) }
    const info = typeof t === 'function' ? t() : undefined
    switch (info?.[0]) {
        case 'string': return ok('decode_string')
        case 'number': return ok('decode_number')
        case 'boolean': return ok('decode_bool')
        case 'bigint': return ok('decode_bytes')
        default: return refuse(t, 'no reader for a schema')
    }
}

/**
 * The function that writes a schema with nothing to write it by.
 *
 * @type {(t: unknown) => _Printed}
 */
const atomicWriter = t => {
    const name = nameOf(t)
    if (name !== undefined) { return ok(`encode_${snake(name)}`) }
    if (isNothing(t)) { return ok('encode_nothing') }
    const info = typeof t === 'function' ? t() : undefined
    switch (info?.[0]) {
        case 'string': return ok('encode_string')
        case 'number': return ok('encode_number')
        case 'boolean': return ok('encode_bool')
        case 'bigint': return ok('encode_bytes')
        default: return refuse(t, 'no writer for a schema')
    }
}

/**
 * A schema read from the Rust expression `x`, a `Result`.
 *
 * @type {(t: unknown, x: string) => _Printed}
 */
export const read = (t, x) => {
    const c = composite(t)
    if (c === undefined) { return bind(f => ok(`${f}(${x})`))(atomicReader(t)) }
    if (c[0] === 'array') { return bind(f => ok(`decode_array(${x}, ${f})`))(reader(c[1])) }
    if (c[0] === 'nullable') { return bind(f => ok(`decode_nullable(${x}, ${f})`))(reader(c[1])) }
    return refuse(t, 'no reader for a Result')
}

/**
 * The function that reads a schema.
 *
 * @type {(t: unknown) => _Printed}
 */
const reader = t => composite(t) === undefined ? atomicReader(t) : bind(r => ok(`|v| ${r}`))(read(t, 'v'))

/**
 * A schema written from the Rust expression `x`, an `Any`.
 *
 * @type {(t: unknown, x: string) => _Printed}
 */
export const write = (t, x) => {
    const c = composite(t)
    if (c === undefined) { return bind(f => ok(`${f}(${x})`))(atomicWriter(t)) }
    if (c[0] === 'array') { return bind(f => ok(`encode_array(${x}, ${f})`))(writer(c[1])) }
    if (c[0] === 'nullable') { return bind(f => ok(`encode_nullable(${x}, ${f})`))(writer(c[1])) }
    return bind(a => bind(b => ok(`encode_result(${x}, ${a}, ${b})`))(writer(c[2])))(writer(c[1]))
}

/**
 * The function that writes a schema.
 *
 * @type {(t: unknown) => _Printed}
 */
const writer = t => composite(t) === undefined ? atomicWriter(t) : bind(w => ok(`|v| ${w}`))(write(t, 'v'))

/**
 * What a named schema holds, which a reader or writer of it may reach.
 *
 * @type {(t: unknown) => readonly unknown[]}
 */
const parts = t => {
    if (tag(t) !== undefined) { return /** @type {readonly unknown[]} */ (t).slice(1) }
    if (typeof t === 'function') { return /** @type {readonly unknown[]} */ (members(t)).flatMap(parts) }
    return Object.values(/** @type {object} */ (t))
}

/**
 * The named types a schema reaches, with the ones already found.
 *
 * @type {(found: readonly (readonly [string, unknown])[], t: unknown) => readonly (readonly [string, unknown])[]}
 */
export const reach = (found, t) => {
    const name = nameOf(t)
    if (name !== undefined) {
        return found.some(([, s]) => s === t) ? found : parts(t).reduce(reach, [...found, [name, t]])
    }
    if (typeof t === 'function') {
        const info = t()
        return info[0] === 'array' ? reach(found, info[1]) : info[0] === 'or' ? info.slice(1).reduce(reach, found) : found
    }
    return Array.isArray(t) ? t.slice(1).reduce(reach, found) : found
}

/** The named types in the order they are declared. @type {(found: readonly (readonly [string, unknown])[]) => readonly (readonly [string, unknown])[]} */
const declared = found => types.filter(([, t]) => found.some(([, s]) => s === t))

const attribute = '#[rustfmt::skip]'

/**
 * `a, b` as the lines of a Rust block, indented.
 *
 * @type {(lines: readonly string[]) => string}
 */
const block = lines => lines.map(l => `    ${l}`).join('\n')

/**
 * A struct's reader: a closed object, each member read where it is, left
 * out where it may be, and checked where it is a constant.
 *
 * @type {(name: string, s: { readonly [k in string]: unknown }) => Result<string, readonly unknown[]>}
 */
const structReader = (name, s) => {
    const entries = Object.entries(s)
    const keys = entries.map(([k]) => `"${k}"`).join(', ')
    return bind(
        (/** @type {readonly _Member[]} */ rs) => {
            const checks = rs.flatMap(([c]) => c)
            const fields = rs.flatMap(([, f]) => f)
            const construct = fields.length === 0 ? name : `${name} {\n${block(fields.map(f => `    ${f},`))}\n    }`
            return ok([
                attribute,
                `fn decode_${snake(name)}<A: IVm>(any: Any<A>) -> Result<${name}, Malformed> {`,
                `    let object = decode_object(any, &[${keys}])?;`,
                ...checks.map(c => `    ${c}`),
                `    Ok(${construct})`,
                '}',
                '',
            ].join('\n'))
        })(all(entries.map(([k, m]) => {
            if (typeof m !== 'function') {
                return m === true
                    ? memberReader([`decode_true(required(&object, "${k}")?)?;`], [])
                    : refuse(m, 'no reader for a constant')
            }
            const rest = optional(m)
            const f = snake(k)
            if (rest === undefined) {
                return bind(r => memberReader([], [`${f}: ${r}?`]))(read(m, `required(&object, "${k}")?`))
            }
            if (rest.length !== 1) { return refuse(m, 'no reader for an optional member of several types') }
            if (rest[0] === true) { return memberReader([], [`${f}: decode_flag(member(&object, "${k}"))?`]) }
            return bind(r => memberReader([], [`${f}: decode_optional(member(&object, "${k}"), ${r})?`]))(reader(rest[0]))
        })))
}

/**
 * A union of strings read as its unit enum.
 *
 * @type {(name: string, ms: readonly unknown[]) => string}
 */
const choiceReader = (name, ms) => {
    const arms = ms.map((m, i) => `        ${i === ms.length - 1 ? '_' : i} => ${name}::${pascal(/** @type {string} */ (m))},`)
    return [
        attribute,
        `fn decode_${snake(name)}<A: IVm>(any: Any<A>) -> Result<${name}, Malformed> {`,
        `    Ok(match decode_choice(any, &[${ms.map(m => `"${m}"`).join(', ')}])? {`,
        ...arms,
        '    })',
        '}',
        '',
    ].join('\n')
}

/**
 * A named schema's reader.
 *
 * @type {(entry: readonly [string, unknown]) => Result<string, readonly unknown[]>}
 */
export const definitionReader = ([name, t]) => {
    if (tag(t) !== undefined) { return refuse(t, 'no reader for a tagged tuple') }
    const ms = members(t)
    if (ms === undefined) { return structReader(name, /** @type {{ readonly [k in string]: unknown }} */ (t)) }
    return typeof ms[0] === 'string' ? ok(choiceReader(name, ms)) : refuse(t, 'no reader for a union of tagged tuples')
}

/**
 * A struct's writer: its members that are there, in order.
 *
 * @type {(name: string, s: { readonly [k in string]: unknown }) => Result<string, readonly unknown[]>}
 */
const structWriter = (name, s) => {
    const entries = Object.entries(s)
    return bind(
        (/** @type {readonly string[]} */ items) => ok([
            attribute,
            `fn encode_${snake(name)}<A: IVm>(${entries.every(([, m]) => typeof m !== 'function') ? '_value' : 'value'}: ${name}) -> Any<A> {`,
            '    encode_object(vec![',
            ...items.map(i => `        ${i},`),
            '    ])',
            '}',
            '',
        ].join('\n')))(all(entries.map(([k, m]) => {
            if (typeof m !== 'function') {
                return m === true ? ok(`Some(("${k}", encode_bool(true)))`) : refuse(m, 'no writer for a constant')
            }
            const rest = optional(m)
            const f = snake(k)
            if (rest === undefined) { return bind(w => ok(`Some(("${k}", ${w}))`))(write(m, `value.${f}`)) }
            if (rest.length !== 1) { return refuse(m, 'no writer for an optional member of several types') }
            if (rest[0] === true) { return ok(`value.${f}.then(|| ("${k}", encode_bool(true)))`) }
            return bind(w => ok(`value.${f}.map(|v| ("${k}", ${w}))`))(write(rest[0], 'v'))
        })))
}

/**
 * A union of strings written from its unit enum.
 *
 * @type {(name: string, ms: readonly unknown[]) => string}
 */
const choiceWriter = (name, ms) => [
    attribute,
    `fn encode_${snake(name)}<A: IVm>(value: ${name}) -> Any<A> {`,
    '    match value {',
    ...ms.map(m => `        ${name}::${pascal(/** @type {string} */ (m))} => encode_string("${m}".to_string()),`),
    '    }',
    '}',
    '',
].join('\n')

/**
 * A tagged tuple written as `[tag, ...items]`, each item read off `access`.
 *
 * @type {(items: readonly unknown[], access: (i: number) => string) => Result<string, readonly unknown[]>}
 */
const tupleItems = (items, access) => bind(
    (/** @type {readonly string[]} */ ws) => ok(`vec![${ws.join(', ')}]`))(
    all(items.map((m, i) => write(m, access(i)))))

/**
 * A union of tagged tuples written from its enum, a variant per tag.
 *
 * @type {(name: string, ms: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const taggedWriter = (name, ms) => bind(
    (/** @type {readonly string[]} */ arms) => ok([
        attribute,
        `fn encode_${snake(name)}<A: IVm>(value: ${name}) -> Any<A> {`,
        '    match value {',
        ...arms.map(a => `        ${a},`),
        '    }',
        '}',
        '',
    ].join('\n')))(
    all(ms.map(m => {
        const t = /** @type {string} */ (tag(m))
        const items = /** @type {readonly unknown[]} */ (m).slice(1)
        const bindings = items.map((_, i) => `f${i}`)
        const pattern = items.length === 0 ? '' : `(${bindings.join(', ')})`
        return bind(v => ok(`${name}::${pascal(t)}${pattern} => encode_tuple("${t}", ${v})`))(tupleItems(items, i => bindings[i]))
    })))

/**
 * A named tagged tuple written as a tuple struct.
 *
 * @type {(name: string, t: readonly unknown[]) => Result<string, readonly unknown[]>}
 */
const tupleWriter = (name, t) => bind(
    (/** @type {string} */ v) => ok([
        attribute,
        `fn encode_${snake(name)}<A: IVm>(value: ${name}) -> Any<A> {`,
        `    encode_tuple("${t[0]}", ${v})`,
        '}',
        '',
    ].join('\n')))(
    tupleItems(t.slice(1), i => `value.${i}`))

/**
 * A named schema's writer.
 *
 * @type {(entry: readonly [string, unknown]) => Result<string, readonly unknown[]>}
 */
export const definitionWriter = ([name, t]) => {
    if (tag(t) !== undefined) { return tupleWriter(name, /** @type {readonly unknown[]} */ (t)) }
    const ms = members(t)
    if (ms === undefined) { return structWriter(name, /** @type {{ readonly [k in string]: unknown }} */ (t)) }
    return typeof ms[0] === 'string' ? ok(choiceWriter(name, ms)) : taggedWriter(name, ms)
}

/**
 * One parameter as the request's reader gives it: the statements that read
 * it, and the argument it passes, if it passes one. A constant is checked and
 * passes nothing; a parameter that may be left out is `decode_optional` of
 * what the payload has there; one that may be `null` is `decode_nullable`.
 *
 * @type {(name: string, t: unknown, i: number) => Result<readonly [string, string | undefined], readonly unknown[]>}
 */
export const parameter = (name, t, i) => {
    const argument = `argument(payload, ${i}, "${name}")?`
    if (typeof t !== 'function' && t !== undefined && nameOf(t) === undefined) {
        return typeof t === 'string'
            ? ok([`decode_literal(${argument}, "${t}")?;`, undefined])
            : refuse(t, 'no reader for a constant parameter')
    }
    const rest = optional(t)
    const v = snake(name)
    if (rest !== undefined) {
        return rest.length === 1
            ? bind(r => ok(/** @type {const} */ ([`let ${v} = decode_optional(payload.get(${i}).cloned(), ${r})?;`, v])))(reader(rest[0]))
            : refuse(t, 'no reader for an optional parameter of several types')
    }
    return bind(r => ok(/** @type {const} */ ([`let ${v} = ${r}?;`, v])))(read(t, argument))
}

/**
 * An operation's call: read the request, run the method, write the answer.
 *
 * @type {(o: { readonly name: string, readonly params: readonly unknown[], readonly answer: unknown, readonly names: readonly string[] }) => Result<string, readonly unknown[]>}
 */
export const call = ({ name, params, answer, names }) => bind(
    (/** @type {readonly (readonly [string, string | undefined])[]} */ ps) => bind(
        (/** @type {string} */ w) => ok([
            attribute,
            `fn call_${snake(name)}<A: IVm, R: Operations>(runner: &mut R, payload: &[Any<A>]) -> Result<Any<A>, Malformed> {`,
            `    arity(payload, ${params.length})?;`,
            ...ps.map(([statement]) => `    ${statement}`),
            `    Ok(${w})`,
            '}',
            '',
        ].join('\n')))(
        write(answer, `runner.${snake(name)}(${ps.flatMap(([, a]) => a === undefined ? [] : [a]).join(', ')})`)))(
    all(params.map((t, i) => parameter(names[i], t, i))))

const header = `// @generated by \`npm run gen\` from \`fjs/effects/schema/rust/dispatch/module.f.mjs\`.
// Do not edit: change the schemas in \`fjs/effects/schema/module.f.mjs\` and regenerate.

use crate::*;
use nanvm_lib::vm::{Any, IVm};
`

/**
 * The generated Rust file: the readers and writers of the named types a
 * request or an answer holds, each operation's call, and `dispatch`.
 *
 * @type {() => Result<string, readonly unknown[]>}
 */
export const generate = () => {
    const ops = /** @type {readonly _Operation[]} */ (Object.values(operations))
    const requests = declared(ops.flatMap(o => o.params).reduce(reach, []))
    const answers = declared(ops.map(o => o.answer).reduce(reach, []))
    const dispatch = [
        '/// The operation `command` names run against `payload`, or `None` where this',
        '/// runner has no such operation.',
        attribute,
        'pub fn dispatch<A: IVm, R: Operations>(runner: &mut R, command: &str, payload: &[Any<A>]) -> Option<Result<Any<A>, Malformed>> {',
        '    match command {',
        ...ops.map(o => `        "${o.name}" => Some(call_${snake(o.name)}(runner, payload)),`),
        '        _ => None,',
        '    }',
        '}',
        '',
    ].join('\n')
    return bind(
        (/** @type {readonly string[]} */ readers) => bind(
            (/** @type {readonly string[]} */ writers) => bind(
                (/** @type {readonly string[]} */ calls) => ok([header, ...readers, ...writers, ...calls, dispatch].join('\n')))(
                all(ops.map(call))))(
            all(answers.map(definitionWriter))))(
        all(requests.map(definitionReader)))
}
