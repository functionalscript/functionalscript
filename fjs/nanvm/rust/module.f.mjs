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
 * data: {@link rustName} maps a group's key to a Rust identifier explicitly,
 * because `snakeCase` over a punctuation tag such as `*` produces nothing
 * usable. Literal syntax comes from
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
 * @import { Data, Exp as _Exp, Expectation, Group, OpId, SharedNode, Value } from '../types.ts'
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
    caseExp,
    casesOf,
    groupKey,
    isThrows,
    orders,
    sharedExp,
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
 * The Rust function name for each group the corpus covers, keyed by
 * `groupKey`: the operation tag, or for an `Op12` group the tag and its
 * arity, since `-` at one operand and at two are two functions.
 *
 * Written out rather than derived: a canonical id may be punctuation, and the
 * generated function names are this printer's concern and stay stable when an
 * id is respelled — `neg` and `unary_plus` were named for the ids `neg` and
 * `unaryPlus` and kept their names when those became `-` and `+`.
 *
 * @type {{ readonly [k in string]?: string }}
 */
export const rustName = {
    '?:': 'conditional',
    '+/1': 'unary_plus',
    '-/1': 'neg',
    '~': 'bitwise_not',
    '*': 'mul',
    '/': 'div',
    '**': 'pow',
    '-/2': 'sub',
    '+/2': 'add',
    '%': 'rem',
    '&': 'bitand',
    '|': 'bitor',
    '^': 'bitxor',
    '<<': 'shl',
    '>>': 'shr',
    '>>>': 'unsigned_right_shift',
    '<': 'lt',
    '<=': 'le',
    '>': 'gt',
    '>=': 'ge',
    '!': 'not',
    '&&': 'logical_and',
    '||': 'logical_or',
    '??': 'nullish_coalescing',
    own: 'own_property',
    '===': 'eq',
    typeof: 'typeof_',
    String: 'string_coercion',
}

/**
 * The `nanvm-lib` expression each unary operation prints as.
 *
 * @type {{ readonly [k in OpId]?: (a: string) => string }}
 */
const op1Rust = {
    '+': a => `Any::unary_plus(${a})`,
    '-': a => `-(${a})`,
    '!': a => `!(${a})`,
    '~': a => `Any::bitwise_not(${a})`,
    typeof: a => `Any::typeof_(${a})`,
    String: a => `${a}.to_string().map(|v| v.to_any())`,
}

/**
 * The same, for the binary operations.
 *
 * An operator not yet implemented in `nanvm-lib` (such as `=>`) has every one
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
 * for what they do rather than reusing punctuation Rust already owns. `>>>`
 * follows it for a fourth reason: Rust has no unsigned-right-shift operator
 * at all (only `>>`, which is arithmetic on a signed type), so it is
 * `Any::unsigned_right_shift`. `own` follows it for a fifth: no Rust
 * operator spells a keyed property lookup at all, so it is
 * `Any::own_property`.
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
    '&': (a, b) => `${a} & ${b}`,
    '|': (a, b) => `${a} | ${b}`,
    '^': (a, b) => `${a} ^ ${b}`,
    '<<': (a, b) => `${a} << ${b}`,
    '>>': (a, b) => `${a} >> ${b}`,
    '>>>': (a, b) => `Any::unsigned_right_shift(${a}, ${b})`,
    '<': (a, b) => `Any::lt(${a}, ${b})`,
    '<=': (a, b) => `Any::le(${a}, ${b})`,
    '>': (a, b) => `Any::gt(${a}, ${b})`,
    '>=': (a, b) => `Any::ge(${a}, ${b})`,
    '&&': (a, b) => `Any::logical_and(${a}, ${b})`,
    '||': (a, b) => `Any::logical_or(${a}, ${b})`,
    '??': (a, b) => `Any::nullish_coalescing(${a}, ${b})`,
    own: (a, b) => `Any::own_property(${a}, ${b})`,
    // `==` on `Any` *is* JavaScript's `===`, but it yields a `bool` and so
    // pins neither operand's `A`, and `check` takes the `Result` every other
    // operator returns — both of which `strict_eq` in the harness settles.
    '===': (a, b) => `strict_eq(${a}, ${b})`,
}

/**
 * The same, for the one ternary operation (`?:`) — another method, for the
 * same reason as `&&`/`||`/`??`: Rust's own `if`/`else` takes a `bool`
 * condition, not an `Any<A>` one, so there is no infix spelling to reuse.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string, c: string) => string }}
 */
const op3Rust = {
    '?:': (a, b, c) => `Any::conditional(${a}, ${b}, ${c})`,
}

/**
 * What a key names in this printer. A key with no entry is a gap here, not a
 * case to print a plausible wrong statement for.
 *
 * @type {<K extends string, T>(table: { readonly [k in K]?: T }) => (id: K) => T}
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
        && e[0] !== 'undefined' && e[0] !== '[]' && e[0] !== '{}' && e[0] !== '=>'
    /** @type {(e: Exp) => string} */
    const f = e => {
        if (!(e instanceof Array)) { return primitiveExpr(e) }
        const bound = shared.find(([n]) => n === e)
        if (bound !== undefined) { return bound[1] }
        const [id, a, b, c] = /** @type {readonly any[]} */ (e)
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
        if (id === '=>') {
            // `nanvm-lib` has no closures yet, so no `=>` node prints as one.
            // The corpus's function value is `() => undefined` (`lambdaExp` in
            // `../module.f.mjs`), which no operator inspects, and the harness
            // has one function value to stand in for it; exactly that node
            // prints as the stand-in, and any other lambda is refused rather
            // than printed as a function it is not.
            if (!isSmallestLambda(a, b)) { throw ['no Rust for', e] }
            return 'function_any()'
        }
        return e.length === 2 ? op1(id)(nested(a))
            : e.length === 3 ? op2(id)(nested(a), nested(b))
            : op3(id)(nested(a), nested(b), nested(c))
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
 * `true` for the operands of `() => undefined`: an empty frame and the
 * `undefined` node — the one `=>` this printer has a spelling for.
 *
 * @type {(frame: Exp, body: Exp) => boolean}
 */
const isSmallestLambda = (frame, body) =>
    frame instanceof Array && frame[0] === '[]' && frame[1].length === 0
    && body instanceof Array && body[0] === 'undefined'

/**
 * The same, for a node nothing shares — every node in a group that reaches
 * no shared value,
 * and every `expected`.
 *
 * @type {(e: Exp) => string}
 */
export const nodeExpr = expExpr([])

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
 * `true` when `e` reaches `n` — the arrays are the graph, so this is the
 * whole of "does this expression use that node".
 *
 * @type {(e: unknown, n: Exp) => boolean}
 */
const reaches = (e, n) =>
    e === n || (e instanceof Array && e.some(x => reaches(x, n)))

/**
 * The shared nodes one group's statements need bound, in order.
 *
 * Reaching the node is the whole test, with no transitive step to take: a
 * node shared *through* another — `wrapper` holding `base` — is that node by
 * identity, so it is literally inside the same expression and `reaches`
 * finds it there. A group that reaches none gets no bindings, which is every
 * group but `'==='`, and is why their printed functions are what they were.
 *
 * @type {(shared: readonly SharedNode[]) => (g: Group) => readonly SharedNode[]}
 */
const usedShared = shared => g => {
    const exps = casesOf(g).flatMap(
        c => orders(g)(c).map(([, args]) => caseExp(shared)(g)(args)))
    return shared.filter(([, n]) => exps.some(e => reaches(e, n)))
}

/** @type {(shared: readonly SharedNode[]) => (g: Group) => readonly string[]} */
const groupFn = shared => g => {
    const used = usedShared(shared)(g)
    /** @type {(s: SharedNode) => readonly[Exp, string]} */
    const binding = ([k, node]) => [node, `${snakeCase(k)}.clone()`]
    return [
        '#[rustfmt::skip]',
        `fn ${fnName(groupKey(g))}<A: IVm>() {`,
        // An initializer is printed against the bindings established before
        // it, so a `ref` to an earlier shared value clones that binding
        // rather than constructing a second object. Printed without them the
        // Rust heap graph would not be the graph the nodes describe.
        ...used.map(([k, node], i) =>
            `${indent}let ${snakeCase(k)}: Any<A> = ${
                expExpr(used.slice(0, i).map(binding))(node)};`),
        ...casesOf(g).flatMap(c => orders(g)(c).flatMap(([name, args]) =>
            emit(c.rust)(assertion(c.expected)(name)(
                expExpr(used.map(binding))(caseExp(shared)(g)(args)))))),
        '}',
        '',
    ]
}

/** @type {(data: Data) => string} */
export const generate = data => {
    const shared = sharedExp(data.shared)
    return [
        '// @generated by `npm run gen` from `fjs/nanvm/module.f.mjs`.',
        '// Do not edit: change the shared operator test data and regenerate.',
        '',
        'use super::harness::*;',
        '',
        ...data.groups.flatMap(groupFn(shared)),
        'pub fn all<A: IVm>() {',
        ...data.groups.map(g => `${indent}${fnName(groupKey(g))}::<A>();`),
        '}',
        '',
    ].join('\n')
}
