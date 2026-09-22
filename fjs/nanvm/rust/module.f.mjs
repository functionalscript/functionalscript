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
 * The node printer and its binding mechanism are not this module's own:
 * they live in [`fjs/edag/rust`](../../edag/rust/module.f.mjs), shared
 * with the `.rs` output branch of `fjs compile`
 * (`fjs/fsc/rust/module.f.mjs`), so the operator tables and the mechanism
 * have one copy between the two generators. What stays here is everything
 * test-corpus-specific: naming a group's Rust function, the per-group `let`
 * bindings a case's shared operands need, and the assertion statements
 * themselves.
 *
 * Rust naming is this module's alone and never leaks back into the shared
 * data: {@link rustName} maps a group's key to a Rust identifier explicitly,
 * because `snakeCase` over a punctuation tag such as `*` produces nothing
 * usable.
 *
 * Every emitted function carries `#[rustfmt::skip]`: the line layout here is
 * one statement per case, and `cargo fmt -- --check` runs in CI, so the
 * printer would otherwise have to reproduce rustfmt's wrapping exactly.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Data, Expectation, Group, SharedNode, Value } from '../types.ts'
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
import { snakeCase, stringLiteral } from '../../media/rust/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { braced, expExpr as sharedExpExpr, indent, nestsOperation, statementsOf } from '../../edag/rust/module.f.mjs'

/**
 * The shared printer as a throwing convenience, for this module's own use:
 * every case in the shared operator corpus is already valid, so a refusal
 * here is a bug in the corpus, not an expected outcome to report as a
 * `Result` — the same distinction {@link expExpr}'s own doc comment draws,
 * decided the other way for a different consumer.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => string}
 */
const expExpr = shared => e => unwrap(sharedExpExpr(shared)(e))

/** @type {(e: Exp) => string} */
export const nodeExpr = e => unwrap(sharedExpExpr([])(e))

/**
 * A case's result as the `Result` `check` takes: one bare operation over
 * its operands as written — the flat statement every case has been —
 * unless an operation stands in an eager position, which a bare statement
 * has no line to bind on. Then the case is a scope, `scope(|| { … })`: its
 * temporaries bound inside the closure with their `?`, and the root's own
 * `Result` the closure's answer, handed to `check` whole — the shape a
 * thunk's body and a compiled module already have (`fjs/edag/rust`'s
 * `statementsOf`). `scope` is the harness's, a name for the call rather
 * than `(|| …)()`, which clippy calls redundant.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => string}
 */
const caseText = shared => e => nestsOperation(shared)(e)
    ? `scope(|| ${braced(unwrap(statementsOf(shared)(e)))})`
    : expExpr(shared)(e)

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
    '!==': 'ne',
    typeof: 'typeof_',
    String: 'string_coercion',
}

/**
 * What a key names in {@link rustName}. A key with no entry is a gap here,
 * not a case to print a plausible wrong function name for.
 *
 * @type {(id: string) => string}
 */
const fnName = id => {
    const v = rustName[id]
    if (v === undefined) { throw ['no Rust for', id] }
    return v
}

/**
 * A statement's lines, indented into the group's function — one, unless a
 * lazy operand's thunk binds temporaries of its own, a block over several
 * (`fjs/edag/rust`'s printer) — or, for a statement `nanvm-lib` cannot
 * pass yet, the same commented out, keeping the case visible in the
 * generated file as the work still to do.
 *
 * Reason and statement together, on the statement's first line: a group
 * where every case carries the same `rust` reason (an operator with no
 * `nanvm-lib` implementation at all, such as `&`) would otherwise repeat
 * that reason on its own line before each one, doubling the line count for
 * no new information.
 *
 * @type {(reason: string|undefined) => (statement: string) => readonly string[]}
 */
const emit = reason => statement => statement.split('\n').map((line, i) =>
    `${indent}${reason === undefined ? '' : i === 0 ? `// TODO: ${reason}: ` : '// '}${line}`)

/**
 * A case's name as the Rust string literal `check` takes. The names are the
 * corpus's own, so one `stringLiteral` refuses is a defect in the corpus,
 * not an input to report: unwrapped, as {@link nodeExpr} above unwraps the
 * printer for the same reason.
 *
 * @type {(name: string) => string}
 */
const nameLiteral = name => unwrap(stringLiteral(name))

/** @type {(expected: Expectation) => (name: string) => (result: string) => string} */
const assertion = expected => name => result => isThrows(expected)
    ? `check_throws::<A>(${nameLiteral(name)}, ${result});`
    : `check::<A>(${nameLiteral(name)}, ${result}, ${nodeExpr(valueExp(expected))});`

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
        `fn ${fnName(groupKey(g))}<A: IStaticFunction>() {`,
        // An initializer is printed against the bindings established before
        // it, so a `ref` to an earlier shared value clones that binding
        // rather than constructing a second object. Printed without them the
        // Rust heap graph would not be the graph the nodes describe.
        ...used.map(([k, node], i) =>
            `${indent}let ${snakeCase(k)}: Any<A> = ${
                expExpr(used.slice(0, i).map(binding))(node)};`),
        ...casesOf(g).flatMap(c => orders(g)(c).flatMap(([name, args]) =>
            emit(c.rust)(assertion(c.expected)(name)(
                caseText(used.map(binding))(caseExp(shared)(g)(args)))))),
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
        'use nanvm_lib::vm::unstable::{bigint_any, f64_any, strict_eq, strict_ne, string_any, string_key};',
        '',
        ...data.groups.flatMap(groupFn(shared)),
        'pub fn all<A: IStaticFunction>() {',
        ...data.groups.map(g => `${indent}${fnName(groupKey(g))}::<A>();`),
        '}',
        '',
    ].join('\n')
}
