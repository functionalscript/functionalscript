/**
 * The `.rs` output branch of `fjs compile`: a linked EDAG printed as a
 * self-contained Rust module that builds the module's value through the
 * `nanvm-lib` API —
 * [mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md),
 * [fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md).
 *
 * The node printer and its `let`-binding sharing mechanism are not this
 * module's own: they live in
 * [`fjs/edag/rust`](../../edag/rust/module.f.mjs), shared with
 * [`fjs/nanvm/rust`](../../nanvm/rust/module.f.mjs), which prints the
 * operator conformance corpus the same way. What is specific to this module:
 * finding a whole module's implicitly shared nodes ({@link sharedNodesOf}
 * over the linked EDAG, rather than a corpus's explicit named `shared`),
 * naming them, assembling the `pub fn module<A: IVm>() -> Any<A>` a harness
 * can call, and picking exactly the `nanvm_lib` imports and private helpers
 * the printed text actually needs — no harness crate to `use`, since this
 * output is meant to compile inside whatever crate a caller drops it into.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Node } from '../../edag/analysis/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { error, mapOk, ok, okThen, unwrap } from '../../types/result/module.f.mjs'
import { expExpr, op1Rust, op2Rust, sharedNodesOf } from '../../edag/rust/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'

const indent = '    '

/**
 * The private helpers {@link expExpr} names but does not itself define — the
 * operator-test corpus gets them from `nanvm-lib/tests/test/harness.rs` via
 * `use super::harness::*;`, but a compiled module has no such crate to
 * depend on, so it carries its own copies. Each is included only when the
 * printed body actually calls it, keyed by the call text that says so.
 *
 * @type {readonly { readonly marker: string, readonly lines: readonly string[] }[]}
 */
const helperCatalog = [
    {
        marker: 'string_any(',
        lines: [
            'fn string_any<A: IVm>(v: &str) -> Any<A> {',
            `${indent}v.into()`,
            '}',
        ],
    },
    {
        marker: 'string_key(',
        lines: [
            'fn string_key<A: IVm>(v: &str) -> String<A> {',
            `${indent}v.into()`,
            '}',
        ],
    },
    {
        marker: 'bigint_any(',
        lines: [
            'fn bigint_any<A: IVm>(v: i64) -> Any<A> {',
            `${indent}Into::<BigInt<A>>::into(v).to_any()`,
            '}',
        ],
    },
    {
        marker: 'f64_any(',
        lines: [
            'fn f64_any<A: IVm>(v: u64) -> Any<A> {',
            `${indent}f64::from_bits(v).to_any()`,
            '}',
        ],
    },
]

/** The helper definitions the printed body needs, each followed by a blank line. @type {(body: string) => readonly string[]} */
const helpersFor = body => helperCatalog
    .filter(({ marker }) => body.includes(marker))
    .flatMap(({ lines }) => [...lines, ''])

/**
 * The `nanvm_lib::vm` names a piece of generated text needs, found the same
 * way {@link helpersFor} finds which helper to define: `Any` and `IVm` are
 * always needed — every value is an `Any<A>` and every function is generic
 * over it — and the rest are included only where the text actually spells
 * them, so an empty module never imports `BigInt`.
 *
 * @type {readonly (readonly [string, string])[]}
 */
const importCatalog = [
    ['Nullish::', 'Nullish'],
    ['Array::default', 'Array'],
    ['Object::default', 'Object'],
    ['String<A>', 'String'],
    ['BigInt<A>', 'BigInt'],
    ['.to_any()', 'ToAny'],
    ['.to_array()', 'ToArray'],
    ['.to_object()', 'ToObject'],
]

/** @type {(text: string) => readonly string[]} */
const importsFor = text => [...new Set([
    'Any',
    'IVm',
    ...importCatalog.filter(([marker]) => text.includes(marker)).map(([, name]) => name),
])].sort()

/**
 * The `let` binding lines for the first `i` of `bindings`, each printed
 * against the bindings established before it — or the refusal, from
 * whichever one `expExpr` meets first that it has no `nanvm-lib` spelling
 * for. Recursive rather than a fold, so that a refusal partway through short
 * -circuits the rest without a mutable accumulator.
 *
 * @type {(bindings: readonly (readonly [Exp, string])[]) => (i: number) => Result<readonly string[], readonly unknown[]>}
 */
const letLines = bindings => i => {
    if (i === 0) { return ok([]) }
    const [node] = bindings[i - 1]
    return okThen(prev => mapOk(s => [...prev, `${indent}let c${i - 1}: Any<A> = ${s};`])(expExpr(bindings.slice(0, i - 1))(node)))(letLines(bindings)(i - 1))
}

/**
 * Whether a node is one of `op1Rust`/`op2Rust`'s own — every operator
 * [`../../edag/rust`](../../edag/rust/module.f.mjs) knows a `nanvm-lib`
 * spelling for and a parseable module can reach today, unary minus among
 * them. `op3Rust` has none yet: its one entry, `?:`, is no syntax this
 * compiler's parser admits, so no module this function's caller hands it
 * can hold one — a check for it here would be a branch this repository's
 * own coverage rule refuses to leave unreachable, not a correctness gap.
 * Revisit alongside the ternary landing in the grammar.
 *
 * Every `op1Rust`/`op2Rust` spelling answers `Result<Any<A>, Any<A>>`:
 * each `nanvm-lib` operator on `Any<A>` throws where its JavaScript
 * original does, and every place this module writes a value wants a bare
 * `Any<A>` instead — the `let` bindings and the body alike. So the text an
 * operator node prints does not compile *here*, though it is right where
 * that printer's other caller puts it — a generated operator test hands
 * the `Result` to a checker, `fjs/edag/rust/module.f.mjs`'s own comment on
 * `op2Rust` has why.
 *
 * The lowering folds a negated numeric literal into the leaf, so `-1`
 * reaches this as a number and never as a node at all, printing as it
 * always did; every other operator node is refused here rather than
 * written into a module that does not build. The shape that would serve
 * one is a throwing operation the printer can spell, not a value.
 *
 * @type {(node: Node) => boolean}
 */
const resultOperator = node => node instanceof Array && (
    (node.length === 2 && node[0] in op1Rust)
    || (node.length === 3 && node[0] in op2Rust)
)

/**
 * The module's value as a Rust expression of type `Any<A>`, and the `let`
 * bindings its implicitly shared nodes need first — or the refusal.
 *
 * `analysis(root)` recurses once per operand ({@link ../../edag/analysis/module.f.mjs}),
 * so this refusal is itself reached only up to the depth that walk survives:
 * a module deep enough overflows the call stack before this function can
 * report the clean refusal below. Tracked, not fixed here — the walk is
 * shared infrastructure every EDAG consumer depends on, and a rewrite has
 * to preserve its merge/scope semantics exactly, which is a bigger and
 * riskier change than this refusal's own scope:
 * `fjs/edag/todo/stack-safety.md`.
 *
 * @type {(root: Exp) => Result<readonly string[], readonly unknown[]>}
 */
const bodyLines = root => {
    if (analysis(root).nodes.some(resultOperator)) { return error(['no Rust for an operator in a module', root]) }
    const shared = sharedNodesOf(root)
    /** @type {readonly (readonly [Exp, string])[]} */
    const bindings = shared.map((node, i) => [node, `c${i}.clone()`])
    return okThen(lines => mapOk(s => [...lines, `${indent}${s}`])(expExpr(bindings)(root)))(letLines(bindings)(bindings.length))
}

/**
 * The EDAG as a generated Rust module, or the refusal: a node shape this
 * printer has no `nanvm-lib` spelling for. Never throws — see
 * `fjs/edag/rust/module.f.mjs`'s `expExpr` for why a gap here is a `Result`
 * and not a thrown value.
 *
 * `pub fn module` carries `#[rustfmt::skip]`, the same as every function
 * [`fjs/nanvm/rust`](../../nanvm/rust/module.f.mjs) emits: one node prints as
 * one line regardless of nesting depth, and a moderately nested module
 * already exceeds rustfmt's line-length limit — measured directly, printing
 * a small nested sample and running `cargo fmt -- --check` against it. A
 * layout-preserving printer that stayed under the limit at every nesting
 * depth would have to reproduce rustfmt's own wrapping, which is what the
 * skip avoids paying for.
 *
 * @type {(root: Exp) => Result<string, readonly unknown[]>}
 */
const generateResult = root => mapOk(body => {
    const bodyText = body.join('\n')
    const helpers = helpersFor(bodyText)
    const uses = importsFor(`${bodyText}\n${helpers.join('\n')}`)
    return [
        '// @generated by `fjs compile`. Do not edit: recompile the source module instead.',
        '',
        `use nanvm_lib::vm::{${uses.join(', ')}};`,
        '',
        ...helpers,
        '#[rustfmt::skip]',
        'pub fn module<A: IVm>() -> Any<A> {',
        ...body,
        '}',
        '',
    ].join('\n')
})(bodyLines(root))

/**
 * {@link generateResult} as a throwing convenience, for direct use and for
 * this module's own proofs — `unwrap`'s throw is the ordinary FunctionalScript
 * panic `fjs/AGENTS.md` §1.5 describes, not a caught exception: nothing here
 * recovers from it, so it propagates uncaught exactly as a thrown value with
 * no `try`/`catch` does.
 *
 * @type {(root: Exp) => string}
 */
export const generate = root => unwrap(generateResult(root))

/**
 * The reason {@link generateResult} refused, as text. Every refusal
 * `expExpr` reports (`fjs/edag/rust/module.f.mjs`) is a `[reason, detail]`
 * pair — `lookup`'s convention, kept by every refusal added since — never a
 * bare value, so joining the pair's own `String` forms is exact rather than
 * approximate.
 *
 * @type {(reason: readonly unknown[]) => string}
 */
const reasonText = reason => reason.map(String).join(': ')

/**
 * The EDAG as Rust, or the refusal: a node shape this printer has no
 * `nanvm-lib` spelling for, reported the same way a `.json` output's refusal
 * is — against the output rather than the input, since the module compiled
 * without complaint. Built directly from {@link generateResult}'s own
 * `Result`, so this module never throws and never needs to catch anything:
 * no `try`/`catch`, and no dependency on a `.mjs` host boundary to supply
 * one, since there is nothing here for FunctionalScript itself to recover
 * from.
 *
 * @type {(root: Exp) => Result<string, string>}
 */
export const toRust = root => {
    const result = generateResult(root)
    return result[0] === 'ok'
        ? result
        : error(`no Rust spelling for this module: ${reasonText(result[1])}`)
}
