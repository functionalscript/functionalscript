/**
 * Prints the shared operator test data as Rust.
 *
 * The output is `nanvm-lib/tests/test/generated.rs`: one statement per case,
 * calling the hand-written helpers in `nanvm-lib/tests/test/harness.rs`. Only
 * the helpers are written by hand — a new operator case is added to
 * [`../module.f.mjs`](../module.f.mjs) and appears on both the JavaScript and
 * the Rust side at once.
 *
 * Literal syntax comes from [`fjs/media/rust`](../../media/rust/module.f.mjs);
 * what is specific to this module is the `nanvm-lib` API the statements target.
 *
 * Every emitted function carries `#[rustfmt::skip]`: the line layout here is
 * one statement per case, and `cargo fmt -- --check` runs in CI, so the
 * printer would otherwise have to reproduce rustfmt's wrapping exactly.
 *
 * @module
 *
 * @import { Case, Data, Eq, Group, Op, Value } from '../types.ts'
 *
 * @example
 *
 * ```js
 * import { generate } from './module.f.mjs'
 * import { data } from '../module.f.mjs'
 *
 * generate(data) // the contents of `nanvm-lib/tests/test/generated.rs`
 * ```
 */

import {
    f64Literal,
    i64Literal,
    snakeCase,
    stringLiteral,
} from '../../media/rust/module.f.mjs'

const { entries } = Object

const indent = '    '

/**
 * Where this printer's output goes, relative to the repository root.
 *
 * `tests/test/` rather than `tests/`: cargo turns every `tests/*.rs` into its
 * own test target, so a generated file directly in `tests/` would be built as
 * a second, harness-less crate. Inside `tests/test/` it is an ordinary
 * submodule of the `tests/test/main.rs` target.
 */
export const directory = 'nanvm-lib/tests/test'

/** @type {string} */
export const path = `${directory}/generated.rs`

/**
 * A Rust expression of type `Any<A>`.
 *
 * Every use site fixes `A`, so no expression needs a turbofish: the harness
 * helpers take `Any<A>` arguments and the shared `let` bindings are annotated.
 *
 * @type {(v: Value) => string}
 */
export const valueExpr = v => {
    if (v === null) { return 'Nullish::Null.to_any()' }
    if (typeof v === 'function') {
        const info = v()
        switch (info[0]) {
            case 'function': { return 'function_any()' }
            case 'ref': { return `${snakeCase(info[1])}.clone()` }
            case 'throw': { throw ['`throws` is not a value', info] }
        }
    }
    switch (typeof v) {
        case 'undefined': { return 'Nullish::Undefined.to_any()' }
        case 'boolean': { return `${v}.to_any()` }
        case 'number': { return `(${f64Literal(v)}).to_any()` }
        case 'string': { return `string_any(${stringLiteral(v)})` }
        case 'bigint': { return `bigint_any(${i64Literal(v)})` }
    }
    if (Array.isArray(v)) {
        const items = v
        return items.length === 0
            ? 'Array::default().to_any()'
            : `[${items.map(valueExpr).join(', ')}].to_array().to_any()`
    }
    const properties = entries(v)
    return properties.length === 0
        ? 'Object::default().to_any()'
        : `[${properties.map(
            ([k, p]) => `(string_key(${stringLiteral(k)}), ${valueExpr(p)})`).join(', ')}].to_object().to_any()`
}

/** @type {(op: Op) => (args: readonly string[]) => string} */
export const call = op => args => {
    switch (op) {
        case 'unaryPlus': { return `Any::unary_plus(${args[0]})` }
        case 'unaryMinus': { return `-(${args[0]})` }
        case 'mul': { return `${args[0]} * ${args[1]}` }
        case 'stringCoercion': { return `${args[0]}.to_string().map(|v| v.to_any())` }
    }
}

/**
 * Comments out a statement `nanvm-lib` cannot pass yet, keeping the case
 * visible in the generated file as the work still to do.
 *
 * @type {(reason: string|undefined) => (statement: string) => readonly string[]}
 */
const emit = reason => statement => reason === undefined
    ? [`${indent}${statement}`]
    : [`${indent}// TODO: ${reason}`, `${indent}// ${statement}`]

/**
 * Every argument order a case is checked in — both for a commutative
 * operator, matching what the JavaScript proof does.
 *
 * @type {(commutative: boolean) => (c: Case) => readonly (readonly[string, readonly Value[]])[]}
 */
const orders = commutative => c => commutative
    ? [[c.name, c.args], [`${c.name}Swapped`, c.args.toReversed()]]
    : [[c.name, c.args]]

/** @type {(expected: Value) => (name: string) => (result: string) => string} */
const assertion = expected => name => result =>
    typeof expected === 'function' && expected()[0] === 'throw'
        ? `check_throws::<A>(${stringLiteral(name)}, ${result});`
        : `check::<A>(${stringLiteral(name)}, ${result}, ${valueExpr(expected)});`

/** @type {(g: Group) => readonly string[]} */
const groupFn = g => [
    '#[rustfmt::skip]',
    `fn ${snakeCase(g.op)}<A: IVm>() {`,
    ...g.cases.flatMap(c => orders(g.commutative === true)(c).flatMap(
        ([name, args]) => emit(c.rust)(
            assertion(c.expected)(name)(call(g.op)(args.map(valueExpr)))))),
    '}',
    '',
]

/** @type {(eq: Eq) => readonly string[]} */
const eqFn = eq => [
    '#[rustfmt::skip]',
    'fn eq<A: IVm>() {',
    ...entries(eq.shared).map(
        ([k, v]) => `${indent}let ${snakeCase(k)}: Any<A> = ${valueExpr(v)};`),
    ...eq.cases.flatMap(c => emit(c.rust)(
        `check_eq::<A>(${stringLiteral(c.name)}, ${valueExpr(c.a)}, ${valueExpr(c.b)}, ${c.eq});`)),
    '}',
    '',
]

/** @type {(data: Data) => string} */
export const generate = data => [
    '// @generated by `npm run ci-update` from `fjs/nanvm/module.f.mjs`.',
    '// Do not edit: change the shared operator test data and regenerate.',
    '',
    'use super::harness::*;',
    '',
    ...eqFn(data.eq),
    ...data.groups.flatMap(groupFn),
    'pub fn all<A: IVm>() {',
    `${indent}eq::<A>();`,
    ...data.groups.map(g => `${indent}${snakeCase(g.op)}::<A>();`),
    '}',
    '',
].join('\n')
