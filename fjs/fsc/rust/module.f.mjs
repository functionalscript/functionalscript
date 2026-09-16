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
 * @import { Result } from '../../types/result/types.ts'
 */

import { error } from '../../types/result/module.f.mjs'
import { tryCatch } from '../../types/result/module.mjs'
import { expExpr, sharedNodesOf } from '../../edag/rust/module.f.mjs'

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
 * The module's value as a Rust expression of type `Any<A>`, and the `let`
 * bindings its implicitly shared nodes need first.
 *
 * @type {(root: Exp) => readonly string[]}
 */
const bodyLines = root => {
    const shared = sharedNodesOf(root)
    /** @type {readonly (readonly [Exp, string])[]} */
    const bindings = shared.map((node, i) => [node, `c${i}.clone()`])
    return [
        ...bindings.map(([node], i) =>
            `${indent}let c${i}: Any<A> = ${expExpr(bindings.slice(0, i))(node)};`),
        `${indent}${expExpr(bindings)(root)}`,
    ]
}

/**
 * The EDAG as a generated Rust module — throws where {@link expExpr} refuses
 * a node shape, as it does for every gap in what `nanvm-lib` implements.
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
 * @type {(root: Exp) => string}
 */
export const generate = root => {
    const body = bodyLines(root)
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
}

/**
 * The reason {@link generate} refused, as text: every refusal it throws is
 * either a `[reason, detail]` pair or a bare string, never a value meant for
 * a human to read as JSON.
 *
 * @type {(reason: unknown) => string}
 */
const reasonText = reason => reason instanceof Array ? reason.map(String).join(': ') : String(reason)

/**
 * The EDAG as Rust, or the refusal: a node shape this printer has no
 * `nanvm-lib` spelling for, reported the same way a `.json` output's refusal
 * is — against the output rather than the input, since the module compiled
 * without complaint.
 *
 * `generate` signals a refusal by throwing, the convention this printer
 * shares with [`fjs/nanvm/rust`](../../nanvm/rust/module.f.mjs); FunctionalScript
 * itself has no `try`/`catch` (`fjs/AGENTS.md` §1.5), so the boundary back to
 * a `Result` is {@link tryCatch}, the impure companion built for exactly
 * this, rather than a `try`/`catch` written here.
 *
 * @type {(root: Exp) => Result<string, string>}
 */
export const toRust = root => {
    const result = tryCatch(() => generate(root))
    return result[0] === 'ok' ? result : error(`no Rust spelling for this module: ${reasonText(result[1])}`)
}
