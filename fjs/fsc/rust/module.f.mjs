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
 * naming them, assembling the `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`
 * a harness can call, and picking exactly the `nanvm_lib` imports the printed text
 * actually needs — the crate is the output's one dependency, so the
 * functions a literal becomes are `vm::unstable`'s, never copied here.
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
 * The `nanvm_lib::vm::unstable` functions the printed body calls — the same
 * ones the operator corpus calls, since both are printed by {@link expExpr}
 * — found by the call text that names them, so a module imports only what
 * it uses. A helper added there to shorten generated code gets a row here
 * once the printer calls it.
 *
 * @type {readonly (readonly [string, string])[]}
 */
const helperCatalog = [
    ['bigint_any(', 'bigint_any'],
    ['f64_any(', 'f64_any'],
    ['string_any(', 'string_any'],
    ['string_key(', 'string_key'],
]

/**
 * The `use nanvm_lib::vm::unstable::…;` line the body needs, or none, spelled
 * as rustfmt spells it: one name bare, several braced.
 *
 * @type {(body: string) => readonly string[]}
 */
const helpersFor = body => {
    const names = helperCatalog.filter(([marker]) => body.includes(marker)).map(([, name]) => name)
    return names.length === 0 ? []
        : [`use nanvm_lib::vm::unstable::${names.length === 1 ? names[0] : `{${names.join(', ')}}`};`]
}

/**
 * The `nanvm_lib::vm` names a piece of generated text needs, found the same
 * way {@link helpersFor} finds which constructors to import: `Any` and
 * `IVm` are always needed — every value is an `Any<A>` and every function is
 * generic over it — and the rest are included only where the text actually
 * spells them, so an empty module never imports `Array`.
 *
 * @type {readonly (readonly [string, string])[]}
 */
const importCatalog = [
    ['Nullish::', 'Nullish'],
    ['Array::default', 'Array'],
    ['Object::default', 'Object'],
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
 * original does. `pub fn module` answers the same `Result` now, so a throw
 * has somewhere to go — a `.` read already propagates with `?` — but the
 * printer does not yet append the `?` an operator's spelling needs, and
 * every place this module writes a value still wants a bare `Any<A>`: the
 * `let` bindings and the body's `Ok(…)` alike. So the text an operator
 * node prints does not compile *here* yet, though it is right where that
 * printer's other caller puts it — a generated operator test hands the
 * `Result` to a checker, `fjs/edag/rust/module.f.mjs`'s own comment on
 * `op2Rust` has why. `fjs/fsc/rust/todo/stage-a-operators.md` is the
 * spelling.
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
 * The module's value as `Ok(…)` of a Rust expression of type `Any<A>` — a
 * `?` inside it propagates a throw out of `module` — and the `let` bindings
 * its implicitly shared nodes need first — or the refusal.
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
    return okThen(lines => mapOk(s => [...lines, `${indent}Ok(${s})`])(expExpr(bindings)(root)))(letLines(bindings)(bindings.length))
}

/** @type {(root: Exp) => boolean} */
const functionRoot = root => {
    if (!(root instanceof Array)) { return false }
    if (root[0] === '=>') { return root[1] === null }
    if (root[0] === '{}' && root[1].length === 1) {
        const property = root[1][0]
        return property instanceof Array && property[0] === ':' && property[1] === 'default'
            && functionRoot(property[2])
    }
    if (root[0] !== ',' || root[1].length === 0) { return false }
    return functionRoot(root[1][root[1].length - 1])
}

/** @type {(root: Exp) => Exp} */
const functionNode = root => root instanceof Array && root[0] === ','
    ? root[1][root[1].length - 1]
    : root instanceof Array && root[0] === '{}' && root[1].length === 1
        ? functionNode(/** @type {any} */ (root[1][0])[2])
    : root

/** @type {(root: Exp) => Result<readonly string[], readonly unknown[]>} */
const functionPrelude = root => {
    if (!(root instanceof Array) || root[0] !== ',') { return ok([]) }
    const prefix = /** @type {readonly Exp[]} */ (root[1].slice(0, -1))
    const lines = prefix.map(node => mapOk(s => `${indent}let _: Any<A> = ${s};`)(expExpr([], { fallible: true })(node)))
    /** @type {(index: number, result: readonly string[]) => Result<readonly string[], readonly unknown[]>} */
    const collect = (index, result) => index === lines.length
        ? ok(result)
        : okThen(first => collect(index + 1, [...result, first]))(lines[index])
    return collect(0, [])
}

/** @type {(root: Exp) => Result<readonly string[], readonly unknown[]>} */
const functionLines = root => {
    const body = /** @type {readonly any[]} */ (functionNode(root))[2]
    const resultBody = body instanceof Array && (body[0] === '.' || body[0] in op1Rust || body[0] in op2Rust)
    return mapOk(s => [
        'fn f0<A: IVm>(_args: &Array<A>) -> Result<Any<A>, Any<A>> {',
        `${indent}${resultBody ? s : `Ok(${s})`}`,
        '}',
        '',
    ])(expExpr([], { args: '_args', fallible: true })(body))
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
const generateResult = root => mapOk(({ lines, prelude }) => {
    const bodyText = lines.join('\n')
    const uses = importsFor(`${bodyText}\n${functionRoot(root) ? 'Array::default()' : ''}`)
    return [
        '// @generated by `fjs compile`. Do not edit: recompile the source module instead.',
        '',
        ...helpersFor(bodyText),
        `use nanvm_lib::vm::{${uses.join(', ')}};`,
        '',
        '#[rustfmt::skip]',
        'pub fn module<A: IVm>() -> Result<Any<A>, Any<A>> {',
        ...(functionRoot(root) ? lines : []),
        ...(functionRoot(root)
            ? [`${indent}let _args: Array<A> = Array::default();`, ...prelude, `${indent}f0(&_args)`]
            : lines),
        '}',
        '',
    ].join('\n')
})(functionRoot(root)
    ? okThen(prelude => mapOk(lines => ({ lines, prelude }))(functionLines(root)))(functionPrelude(root))
    : mapOk(lines => ({ lines, prelude: [] }))(bodyLines(root)))

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
