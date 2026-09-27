/**
 * The `.rs` output branch of `fjs compile`: a linked EDAG printed as a
 * self-contained Rust module that builds the module's value through the
 * `nanvm-lib` API —
 * [mvp-roadmap](../../../nanvm-lib/todo/mvp-roadmap.md),
 * [fjs-nanvm-integration](../../../todo/fjs-nanvm-integration.md).
 *
 * The node printer, its temporaries and the lines of a scope are not this
 * module's own: they live in
 * [`fjs/edag/rust`](../../edag/rust/module.f.mjs), shared with
 * [`fjs/nanvm/rust`](../../nanvm/rust/module.f.mjs), which prints the
 * operator conformance corpus the same way. What is specific to this module:
 * laying a module's scope out as the body of the
 * `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>` a harness can call —
 * `A: IStaticFunction` once the module holds a function, the capability its
 * closures bind through — and picking exactly the `nanvm_lib` imports the
 * printed text actually needs — the crate is the output's one dependency,
 * so the functions a literal becomes are `vm::unstable`'s, never copied here.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { error, mapOk, unwrap } from '../../types/result/module.f.mjs'
import { analysis, bindingError } from '../../edag/analysis/module.f.mjs'
import { holdsFunction, indent, readsArgs, readsFrame, scope } from '../../edag/rust/module.f.mjs'
import { withoutStringLiterals } from '../../media/rust/module.f.mjs'

/**
 * The `nanvm_lib::vm::unstable` functions the printed body calls — the same
 * ones the operator corpus calls, since both are printed by
 * `fjs/edag/rust`'s one printer — found by the call text that names them,
 * so a module imports only what it uses. A helper added there to shorten
 * generated code gets a row here once the printer calls it. The text
 * scanned has its string literals blanked, `withoutStringLiterals`, so a
 * literal spelling a marker is data and not a use.
 *
 * @type {readonly (readonly [string, string])[]}
 */
const helperCatalog = [
    ['bigint_any(', 'bigint_any'],
    ['f64_any(', 'f64_any'],
    ['strict_eq(', 'strict_eq'],
    ['strict_ne(', 'strict_ne'],
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
 * The bound on the module's VM parameter: `IVm`, or `IStaticFunction` —
 * which is `IVm` and the capability to bind a Rust static function — once
 * the module holds a function, read off the EDAG (`holdsFunction`) and not
 * the text: the bound is the output's public API, and no data may change it.
 *
 * @type {(root: Exp) => string}
 */
const vmBound = root => holdsFunction(root) ? 'IStaticFunction' : 'IVm'

/**
 * The `nanvm_lib::vm` names a piece of generated text needs, found the same
 * way {@link helpersFor} finds which constructors to import: `Any` and the
 * VM bound are always needed — every value is an `Any<A>` and every function
 * is generic over it — and the rest are included only where the text
 * actually spells them, so an empty module never imports `Array`.
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

/** @type {(text: string, bound: string) => readonly string[]} */
const importsFor = (text, bound) => [...new Set([
    'Any',
    bound,
    ...importCatalog.filter(([marker]) => text.includes(marker)).map(([, name]) => name),
])].sort()

/**
 * The module's scope, one line per temporary and its `Ok(…)` —
 * `fjs/edag/rust`'s {@link scope}, which also prints every function's body
 * the module holds, each a scope of its own inside its closure — or the
 * refusal. Validate bindings against their owning functions before printing:
 * a fixed read cannot reach past its owner's length, and a closure's frame
 * belongs to the enclosing scope. The fragment printer cannot perform that
 * check without the complete graph. A module has no arguments and no frame,
 * so an `['args']` or
 * `['frame']` node in its own scope — a function body's node, which the lowering
 * never puts here, handed in directly — is refused rather than printed as
 * a name nothing binds.
 *
 * @type {(root: Exp) => Result<readonly string[], readonly unknown[]>}
 */
const bodyLines = root => {
    const problem = bindingError(analysis(root))
    return problem !== null ? error([problem, root])
    : readsArgs(root)
    ? error(['no Rust for `args` in a module\'s own scope; a module has no arguments', root])
    : readsFrame(root)
    ? error(['no Rust for `frame` in a module\'s own scope; a module has no frame', root])
    : mapOk((/** @type {readonly string[]} */ lines) => lines.map(l => `${indent}${l}`))(scope(root))
}

/**
 * The EDAG as a generated Rust module, or the refusal: a node shape this
 * printer has no `nanvm-lib` spelling for, an invalid parameter binding, or
 * a function length above the language's limit.
 * Unsupported output is a `Result`, as in `fjs/edag/rust`'s `scope`.
 * Analysis preconditions still apply: invalid length metadata or a node
 * shared across invocation scopes panics instead of producing output.
 *
 * `pub fn module` carries `#[rustfmt::skip]`, the same as every function
 * [`fjs/nanvm/rust`](../../nanvm/rust/module.f.mjs) emits: the layout is
 * the printer's own — one temporary per line, a closure's body a block
 * under its `let` — and not rustfmt's, which breaks a closure argument
 * and a method chain its own way, and a line still grows with the items
 * of one literal. A layout-preserving printer would have to reproduce
 * rustfmt's own wrapping, which is what the skip avoids paying for.
 *
 * @type {(root: Exp) => Result<string, readonly unknown[]>}
 */
const generateResult = root => mapOk(body => {
    const code = withoutStringLiterals(body.join('\n'))
    const bound = vmBound(root)
    return [
        '// @generated by `fjs compile`. Do not edit: recompile the source module instead.',
        '',
        ...helpersFor(code),
        `use nanvm_lib::vm::{${importsFor(code, bound).join(', ')}};`,
        '',
        '#[rustfmt::skip]',
        `pub fn module<A: ${bound}>() -> Result<Any<A>, Any<A>> {`,
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
 * `scope` reports (`fjs/edag/rust/module.f.mjs`) is a `[reason, detail]`
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
 * `Result`; invalid EDAG preconditions still panic as documented above.
 * No `try`/`catch` or host adapter is needed to report unsupported output.
 *
 * @type {(root: Exp) => Result<string, string>}
 */
export const toRust = root => {
    const result = generateResult(root)
    return result[0] === 'ok'
        ? result
        : error(`no Rust spelling for this module: ${reasonText(result[1])}`)
}
