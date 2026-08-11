/**
 * Prints the shared operator test data as Rust.
 *
 * The output is [`../test/generated.rs`](../test/generated.rs): one statement
 * per case, calling the hand-written helpers in
 * [`../test/harness.rs`](../test/harness.rs). Only the helpers are written by
 * hand — a new operator case is added to
 * [`../module.f.mjs`](../module.f.mjs) and appears on both the JavaScript and
 * the Rust side at once.
 *
 * Every emitted function carries `#[rustfmt::skip]`: the line layout here is
 * one statement per case, and `cargo fmt -- --check` runs in CI, so the
 * printer would otherwise have to reproduce rustfmt's wrapping exactly.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { generate } from './module.f.mjs'
 * import { data } from '../module.f.mjs'
 *
 * generate(data) // the contents of `../test/generated.rs`
 * ```
 */

/** @import { Case, Data, Eq, Expected, Group, Op, Operand, Value } from '../types.ts' */

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
 * `camelCase` names in the data become `snake_case` Rust identifiers. Case
 * names reach Rust only as string literals; this applies to the shared
 * equality values, which become `let` bindings.
 *
 * @type {(s: string) => string}
 */
export const snakeCase = s => [...s].map(c => {
    const lower = c.toLowerCase()
    return c === lower ? c : `_${lower}`
}).join('')

/**
 * A Rust string literal.
 *
 * Any other control character is rejected rather than escaped: nothing in the
 * data needs one, and a silently mangled literal would be worse than a failed
 * regeneration.
 *
 * @type {(s: string) => string}
 */
export const stringLiteral = s => `"${[...s].map(c => {
    switch (c) {
        case '\\': { return '\\\\' }
        case '"': { return '\\"' }
        case '\n': { return '\\n' }
        case '\r': { return '\\r' }
        case '\t': { return '\\t' }
        default: {
            if (c < ' ' || c === '\u007f') { throw ['control character in a Rust string literal', s] }
            return c
        }
    }
}).join('')}"`

/**
 * A Rust `f64` literal.
 *
 * `toString` already prints the shortest round-tripping decimal, and both
 * languages parse decimal `f64` literals the same way, so the digits carry
 * over unchanged; only the three non-finite values and `-0` (which prints as
 * `0`) need spelling out.
 *
 * @type {(v: number) => string}
 */
export const numberLiteral = v => {
    if (Number.isNaN(v)) { return 'f64::NAN' }
    if (v === Infinity) { return 'f64::INFINITY' }
    if (v === -Infinity) { return 'f64::NEG_INFINITY' }
    return `${Object.is(v, -0) ? '-0' : v.toString()}f64`
}

/**
 * A Rust `i64` literal.
 *
 * `bigint_any` takes an `i64`, which covers every value in the data. A larger
 * one would need `BigInt::normalize_new` with explicit limbs, so it is
 * rejected here rather than silently truncated.
 *
 * @type {(v: bigint) => string}
 */
export const bigintLiteral = v => {
    if (v < -(2n ** 63n) || v >= 2n ** 63n) { throw ['bigint out of i64 range', v] }
    return v.toString()
}

/**
 * A Rust expression of type `Any<A>`.
 *
 * Every use site fixes `A`, so no expression needs a turbofish: the operator
 * helpers take `Any<A>` arguments and the shared `let` bindings are annotated.
 *
 * @type {(v: Value) => string}
 */
export const valueExpr = v => {
    switch (v[0]) {
        case 'null': { return 'Nullish::Null.to_any()' }
        case 'undefined': { return 'Nullish::Undefined.to_any()' }
        case 'boolean': { return `${v[1]}.to_any()` }
        case 'number': { return `(${numberLiteral(v[1])}).to_any()` }
        case 'string': { return `string_any(${stringLiteral(v[1])})` }
        case 'bigint': { return `bigint_any(${bigintLiteral(v[1])})` }
        case 'array': {
            return v[1].length === 0
                ? 'Array::default().to_any()'
                : `[${v[1].map(valueExpr).join(', ')}].to_array().to_any()`
        }
        case 'object': {
            return v[1].length === 0
                ? 'Object::default().to_any()'
                : `[${v[1].map(
                    ([k, p]) => `(string_key(${stringLiteral(k)}), ${valueExpr(p)})`).join(', ')}].to_object().to_any()`
        }
        case 'function': { return 'function_any()' }
    }
}

/** @type {(o: Operand) => string} */
export const operandExpr = o =>
    o[0] === 'ref' ? `${snakeCase(o[1])}.clone()` : valueExpr(o)

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

/** @type {(expected: Expected) => (name: string) => (result: string) => string} */
const assertion = expected => name => result => expected[0] === 'throw'
    ? `check_throws::<A>(${stringLiteral(name)}, ${result});`
    : `check::<A>(${stringLiteral(name)}, ${result}, ${valueExpr(expected[1])});`

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
    ...eq.shared.map(([k, v]) => `${indent}let ${snakeCase(k)}: Any<A> = ${valueExpr(v)};`),
    ...eq.cases.flatMap(c => emit(c.rust)(
        `check_eq::<A>(${stringLiteral(c.name)}, ${operandExpr(c.a)}, ${operandExpr(c.b)}, ${c.eq});`)),
    '}',
    '',
]

/** @type {(data: Data) => string} */
export const generate = data => [
    '// @generated by `npm run ci-update` from `nanvm-lib/tests/module.f.mjs`.',
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
