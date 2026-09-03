/**
 * Prints the shared operator test data as Rust.
 *
 * The output is `nanvm-lib/tests/test/generated.rs`: one statement per case,
 * calling the hand-written helpers in `nanvm-lib/tests/test/harness.rs`. Only
 * the helpers are written by hand — a new operator case is added to
 * [`../module.f.mjs`](../module.f.mjs) and appears on both the JavaScript and
 * the Rust side at once.
 *
 * Each statement is printed from the EDAG expression the case denotes, the
 * same expression [`../proof.f.mjs`](../proof.f.mjs) evaluates, so the two
 * consumers read one program rather than each reading the case its own way.
 *
 * Rust naming is this module's alone and never leaks back into the shared
 * data: {@link rustName} maps a canonical operation id to a Rust identifier
 * explicitly, because `snakeCase` over a punctuation tag such as `*` produces
 * nothing usable. Literal syntax comes from
 * [`fjs/media/rust`](../../media/rust/module.f.mjs); what is specific to this
 * module is the `nanvm-lib` API the statements target.
 *
 * Every emitted function carries `#[rustfmt::skip]`: the line layout here is
 * one statement per case, and `cargo fmt -- --check` runs in CI, so the
 * printer would otherwise have to reproduce rustfmt's wrapping exactly.
 *
 * @module
 *
 * @import { Exp, Primitive, Properties } from '../../edag/types.ts'
 * @import { Data, Eq, Expectation, Group, OpId, Operand, SharedNode } from '../types.ts'
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
    arityOf,
    caseExp,
    casesOf,
    isFunctionValue,
    isThrows,
    lowerEq,
    opId,
    orders,
    valueExp,
} from '../module.f.mjs'
import {
    f64Literal,
    i64Literal,
    snakeCase,
    stringLiteral,
} from '../../media/rust/module.f.mjs'

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
 * The Rust function name for each operation the corpus covers.
 *
 * Written out rather than derived: a canonical id may be punctuation, and the
 * generated function names are this printer's concern and stay stable when an
 * id is respelled.
 *
 * @type {{ readonly [k in OpId]?: string }}
 */
export const rustName = {
    unaryPlus: 'unary_plus',
    neg: 'neg',
    '*': 'mul',
    '/': 'div',
    '**': 'pow',
    '-': 'sub',
    '+': 'add',
    '%': 'rem',
    '<': 'lt',
    '<=': 'le',
    '>': 'gt',
    '>=': 'ge',
    '!': 'not',
    '&&': 'logical_and',
    '||': 'logical_or',
    '??': 'nullish_coalescing',
    ternary: 'conditional',
    String: 'string_coercion',
}

/**
 * The `nanvm-lib` expression each unary operation prints as.
 *
 * @type {{ readonly [k in OpId]?: (a: string) => string }}
 */
const op1Rust = {
    unaryPlus: a => `Any::unary_plus(${a})`,
    neg: a => `-(${a})`,
    '!': a => `!(${a})`,
    String: a => `${a}.to_string().map(|v| v.to_any())`,
}

/**
 * The same, for the binary operations.
 *
 * An operator not yet implemented in `nanvm-lib` (such as `&`) has every one
 * of its cases carry a `rust` reason, and `emit` prints this text as a
 * comment rather than a statement — this entry only has to read as the
 * operation, not compile.
 *
 * Rust has no exponentiation operator, so `**` is printed as a call
 * (`Any::pow`) rather than an infix expression, following the
 * `Any::unary_plus` precedent for an operation with no Rust operator to
 * spell. The comparisons follow the same precedent for a different reason:
 * `check` takes a `Result<Any<A>, Any<A>>` against an `Any<A>` expectation,
 * which a `PartialOrd`-derived `<`/`<=`/`>`/`>=` on `Any<A>` would not give
 * back. `&&`/`||`/`??` follow it for a third reason: Rust's own `&&`/`||`
 * take `bool` operands and short-circuit *evaluation*, neither of which fits
 * an operator over already-evaluated `Any<A>` values, and `?` is Rust's own
 * try-operator, unrelated to JS `??` — so all three are `Any` methods, named
 * for what they do rather than reusing punctuation Rust already owns.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string) => string }}
 */
const op2Rust = {
    '*': (a, b) => `${a} * ${b}`,
    '/': (a, b) => `${a} / ${b}`,
    '**': (a, b) => `Any::pow(${a}, ${b})`,
    '-': (a, b) => `${a} - ${b}`,
    '+': (a, b) => `${a} + ${b}`,
    '%': (a, b) => `${a} % ${b}`,
    '<': (a, b) => `Any::lt(${a}, ${b})`,
    '<=': (a, b) => `Any::le(${a}, ${b})`,
    '>': (a, b) => `Any::gt(${a}, ${b})`,
    '>=': (a, b) => `Any::ge(${a}, ${b})`,
    '&&': (a, b) => `Any::logical_and(${a}, ${b})`,
    '||': (a, b) => `Any::logical_or(${a}, ${b})`,
    '??': (a, b) => `Any::nullish_coalescing(${a}, ${b})`,
}

/**
 * The same, for the one ternary operation (`?:`) — another method, for the
 * same reason as `&&`/`||`/`??`: Rust's own `if`/`else` takes a `bool`
 * condition, not an `Any<A>` one, so there is no infix spelling to reuse.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string, c: string) => string }}
 */
const op3Rust = {
    ternary: (a, b, c) => `Any::conditional(${a}, ${b}, ${c})`,
}

/**
 * What an id names in this printer. An id with no entry is a gap here, not a
 * case to print a plausible wrong statement for.
 *
 * @type {<T>(table: { readonly [k in OpId]?: T }) => (id: OpId) => T}
 */
const lookup = table => id => {
    const v = table[id]
    if (v === undefined) { throw ['no Rust for', id] }
    return v
}

const op1 = lookup(op1Rust)

const op2 = lookup(op2Rust)

const op3 = lookup(op3Rust)

const fnName = lookup(rustName)

/** @type {(v: Primitive) => string} */
const primitiveExpr = v => {
    if (v === null) { return 'Nullish::Null.to_any()' }
    switch (typeof v) {
        case 'boolean': { return `${v}.to_any()` }
        case 'number': { return `(${f64Literal(v)}).to_any()` }
        case 'string': { return `string_any(${stringLiteral(v)})` }
        case 'bigint': { return `bigint_any(${i64Literal(v)})` }
    }
}

/**
 * An object key.
 *
 * An EDAG object key is an `exp` — one form for `a:`, `"a":`, and computed
 * `[exp]:` keys alike — and the corpus lowers JavaScript property names, so
 * the key is always the string literal `string_key` takes. A computed one has
 * no `nanvm-lib` spelling here and is refused rather than approximated.
 *
 * @type {(k: Exp) => string}
 */
const keyExpr = k => {
    if (typeof k !== 'string') { throw ['not a literal key', k] }
    return `string_key(${stringLiteral(k)})`
}

/**
 * A Rust expression of type `Any<A>` for an EDAG node.
 *
 * `shared` names the nodes that already have a `let` binding, so a node
 * reached from several places is constructed once and cloned at every
 * reference — EDAG sharing in printed form, and the reason `arrayByItself`
 * compares one object with itself.
 *
 * Every use site fixes `A`, so no expression needs a turbofish: the harness
 * helpers take `Any<A>` arguments and the shared `let` bindings are annotated.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => string}
 */
const expExpr = shared => {
    /**
     * `true` when a node prints as an operator expression.
     *
     * Every other rendering is atomic — a literal, a constructor call, a
     * method chain, or a shared binding's `.clone()` — and survives being an
     * operand as written. An operator expression does not: Rust parses
     * `a * b * c` to the left and binds a method call tighter than `*`, so an
     * unparenthesized composed operand is a different program from the node
     * it was printed from. A shared node is a lowered value and so never an
     * operation, which is why the tag alone decides this.
     *
     * @type {(e: Exp) => boolean}
     */
    const composed = e => e instanceof Array
        && e[0] !== 'undefined' && e[0] !== '[]' && e[0] !== '{}'
    /** @type {(e: Exp) => string} */
    const f = e => {
        if (!(e instanceof Array)) { return primitiveExpr(e) }
        const bound = shared.find(([n]) => n === e)
        if (bound !== undefined) { return bound[1] }
        const [id, a, b] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return 'Nullish::Undefined.to_any()' }
        if (id === '[]') {
            return a.length === 0
                ? 'Array::default().to_any()'
                : `[${a.map(f).join(', ')}].to_array().to_any()`
        }
        if (id === '{}') {
            return a.length === 0
                ? 'Object::default().to_any()'
                : `[${a.map(propertyExpr).join(', ')}].to_object().to_any()`
        }
        return e.length === 2 ? op1(id)(nested(a)) : op2(id)(nested(a), nested(b))
    }
    /** An operand, parenthesized where its rendering would otherwise re-associate. */
    /** @type {(e: Exp) => string} */
    const nested = e => composed(e) ? `(${f(e)})` : f(e)
    /**
     * One object entry.
     *
     * `Properties` is `Property | Spread`, so `['...', exp]` is a valid entry
     * this printer has no `nanvm-lib` spelling for. Read as a property it
     * would take the spread's operand as the key and its absent third element
     * as the value, printing a bare `undefined` into the generated file — text
     * that looks like Rust and is not. Refused for the reason `lookup` refuses
     * an unmapped id, and so that the two entry shapes agree: a spread as an
     * *array* item already refuses, having no operator to render as.
     *
     * @type {(p: Properties) => string}
     */
    const propertyExpr = p => {
        if (p[0] !== ':') { throw ['not a property', p] }
        return `(${keyExpr(p[1])}, ${f(p[2])})`
    }
    return f
}

/**
 * The same, for a node nothing shares — every node outside the `eq` section,
 * and every `expected`.
 *
 * @type {(e: Exp) => string}
 */
export const nodeExpr = expExpr([])

/**
 * A Rust expression for a value, as the printer meets it in the data.
 *
 * `functionValue` is the one value with no expression to lower, which is why
 * a case carrying it escapes; everything else goes through the lowering, so
 * this printer and the JavaScript proof read one derivation and not two.
 *
 * @type {(v: Operand) => string}
 */
export const valueExpr = v => isFunctionValue(v) ? 'function_any()' : nodeExpr(valueExp(v))

/**
 * Comments out a statement `nanvm-lib` cannot pass yet, keeping the case
 * visible in the generated file as the work still to do.
 *
 * One line per case, reason and statement together: a group where every case
 * carries the same `rust` reason (an operator with no `nanvm-lib`
 * implementation at all, such as `&`) would otherwise repeat that reason on
 * its own line before each one, doubling the line count for no new
 * information.
 *
 * @type {(reason: string|undefined) => (statement: string) => readonly string[]}
 */
const emit = reason => statement => reason === undefined
    ? [`${indent}${statement}`]
    : [`${indent}// TODO: ${reason}: ${statement}`]

/** @type {(expected: Expectation) => (name: string) => (result: string) => string} */
const assertion = expected => name => result => isThrows(expected)
    ? `check_throws::<A>(${stringLiteral(name)}, ${result});`
    : `check::<A>(${stringLiteral(name)}, ${result}, ${nodeExpr(valueExp(expected))});`

/**
 * The statement result for one argument order: the case's expression printed,
 * or — for a case the corpus does not lower — the operation applied to printed
 * values.
 *
 * The escape dispatches on the group's arity, as the proof's does, so a
 * binary group's escaped case prints through `op2`, and the one ternary
 * group (`?:`) through `op3`.
 *
 * @type {(g: Group) => (args: readonly Operand[]) => string}
 */
const result = g => args => {
    const lowered = caseExp(g)(args)
    if (lowered[0] === 'exp') { return nodeExpr(lowered[1]) }
    const [a, b, c] = args.map(valueExpr)
    const id = opId(g)
    const arity = arityOf(g)
    return arity === 1 ? op1(id)(a) : arity === 2 ? op2(id)(a, b) : op3(id)(a, b, c)
}

/** @type {(g: Group) => readonly string[]} */
const groupFn = g => [
    '#[rustfmt::skip]',
    `fn ${fnName(opId(g))}<A: IVm>() {`,
    ...casesOf(g).flatMap(c => orders(g)(c).flatMap(
        ([name, args]) => emit(c.rust)(assertion(c.expected)(name)(result(g)(args))))),
    '}',
    '',
]

/** @type {(eq: Eq) => readonly string[]} */
const eqFn = eq => {
    const { shared, cases } = lowerEq(eq)
    /** @type {(s: SharedNode) => readonly[Exp, string]} */
    const binding = ([k, node]) => [node, `${snakeCase(k)}.clone()`]
    const operand = expExpr(shared.map(binding))
    return [
        '#[rustfmt::skip]',
        'fn eq<A: IVm>() {',
        // An initializer is printed against the bindings established before
        // it, so a `ref` to an earlier shared value clones that binding
        // rather than constructing a second object. Printed without them the
        // Rust heap graph would not be the graph the nodes describe.
        ...shared.map(([k, node], i) =>
            `${indent}let ${snakeCase(k)}: Any<A> = ${
                expExpr(shared.slice(0, i).map(binding))(node)};`),
        ...cases.flatMap(([c, [, a, b]]) => emit(c.rust)(
            `check_eq::<A>(${stringLiteral(c.name)}, ${operand(a)}, ${operand(b)}, ${c.eq});`)),
        '}',
        '',
    ]
}

/** @type {(data: Data) => string} */
export const generate = data => [
    '// @generated by `npm run gen` from `fjs/nanvm/module.f.mjs`.',
    '// Do not edit: change the shared operator test data and regenerate.',
    '',
    'use super::harness::*;',
    '',
    ...eqFn(data.eq),
    ...data.groups.flatMap(groupFn),
    'pub fn all<A: IVm>() {',
    `${indent}eq::<A>();`,
    ...data.groups.map(g => `${indent}${fnName(opId(g))}::<A>();`),
    '}',
    '',
].join('\n')
