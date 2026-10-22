/**
 * Writes the Rust of the WASM demo pages' samples
 * ([`todo/wasm-demos.md`](../../../todo/wasm-demos.md)): each sample's
 * `sample.f.js` compiled through the compiler's Rust output into
 * `nanvm/demos/gen.samples/<name>.rs`, and `gen.samples/mod.rs` naming each.
 * The `nanvm-demos` crate reaches the set through one `#[path]` to that
 * `mod.rs`, and builds it for `wasm32` in the deployment build.
 *
 * Invoked from `gen`, so the drift check fails when a committed `.rs` is
 * stale. The samples are listed, not found by a walk: each one also needs an
 * entry in the crate and a demo page, so a new sample is never one file. A
 * sample of its own is a directory beside this module; a spec page's example
 * sits with its page, so the page holds its text, its example and its demo.
 *
 * @module
 *
 * @import { IoChannel, NodeProgram } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 * @import { Place } from './page/types.ts'
 */

import { compileFile, noRuntime } from '../../compiler/module.f.mjs'
import { forEachStep, pureOk, step } from '../../effects/module.f.mjs'
import { exitStep, writeFiles } from '../../effects/node/module.f.mjs'
import { generatedHeader } from '../../media/rust/item/module.f.js'
import { cmp } from '../../types/string/module.f.mjs'
import { rustDirectory, rustPath, samplePath } from './page/module.f.mjs'

export { rustPath, samplePath }

/** The samples, each by its name and the directory that holds it. @type {readonly Place[]} */
export const samples = [
    { name: 'hello', directory: 'fjs/nanvm/demos/hello' },
    { name: 'sort', directory: 'fjs/nanvm/demos/sort' },
    { name: 'collatz', directory: 'fjs/nanvm/demos/collatz' },
    { name: 'comma', directory: 'spec/operators/comma' },
    { name: 'constants', directory: 'spec/bindings/constants' },
    { name: 'destructuring', directory: 'spec/bindings/destructuring' },
    { name: 'member_functions', directory: 'spec/built-ins/member-functions' },
    { name: 'static_functions', directory: 'spec/built-ins/static-functions' },
    { name: 'guards', directory: 'spec/control-flow/guards' },
    { name: 'loops', directory: 'spec/control-flow/loops' },
    { name: 'switch_statement', directory: 'spec/control-flow/switch' },
    { name: 'number_conversion', directory: 'spec/conversions/number' },
    { name: 'string_conversion', directory: 'spec/conversions/string' },
    { name: 'functions', directory: 'spec/functions' },
    { name: 'call_statements', directory: 'spec/functions/call-statements' },
    { name: 'calls', directory: 'spec/functions/calls' },
    { name: 'captures', directory: 'spec/functions/captures' },
    { name: 'function_outputs', directory: 'spec/functions/function-outputs' },
    { name: 'names_and_identity', directory: 'spec/functions/names-and-identity' },
    { name: 'parameters', directory: 'spec/functions/parameters' },
    { name: 'comments', directory: 'spec/lexical/comments' },
    { name: 'identifiers', directory: 'spec/lexical/identifiers' },
    { name: 'string_escapes', directory: 'spec/lexical/string-escapes' },
    { name: 'whitespace', directory: 'spec/lexical/whitespace' },
    { name: 'exports', directory: 'spec/modules/exports' },
    { name: 'operators', directory: 'spec/operators' },
    { name: 'grouping', directory: 'spec/operators/grouping' },
    { name: 'instanceof', directory: 'spec/operators/instanceof' },
    { name: 'property_access', directory: 'spec/property-access' },
    { name: 'entries', directory: 'spec/property-access/entries' },
    { name: 'optional_chaining', directory: 'spec/property-access/optional-chaining' },
    { name: 'values', directory: 'spec/values' },
    { name: 'arrays', directory: 'spec/values/arrays' },
    { name: 'bigints', directory: 'spec/values/bigints' },
    { name: 'numbers', directory: 'spec/values/numbers' },
    { name: 'objects', directory: 'spec/values/objects' },
    { name: 'strings', directory: 'spec/values/strings' },
    { name: 'template_literals', directory: 'spec/values/template-literals' },
]

/** The module file naming every compiled sample, which `src/lib.rs` includes by path. */
export const modulesPath = `${rustDirectory}/mod.rs`

/**
 * The text of `mod.rs`: one `pub mod` per sample, then the export a page
 * loads it by, under the header every generated file carries. Sorted with
 * `string.cmp`, the order `rustfmt` puts `mod` lines in, so `cargo fmt
 * --check` passes whatever order `samples` lists them in.
 *
 * **The exports are generated with the modules**, so a sample is listed
 * once: a page calls its sample's export by the sample's name, and an export
 * written by hand in `src/lib.rs` was one more place to keep in step. A
 * `#[no_mangle]` function is a WebAssembly export wherever in the crate it
 * is defined, and a function and a module share a name without colliding.
 *
 * @type {(names: readonly string[]) => string}
 */
export const modules = names => {
    const sorted = names.toSorted((a, b) => cmp(a)(b))
    return [
        generatedHeader('`fjs run ./fjs/nanvm/demos/module.f.mjs`', 'add or remove a sample instead'),
        '',
        ...sorted.map(name => `pub mod ${name};`),
        ...sorted.flatMap(name => [
            '',
            `/// Loads the \`${name}\` sample.`,
            '#[unsafe(no_mangle)]',
            `pub extern "C" fn ${name}() -> i32 {`,
            `    crate::export(${name}::module::<nanvm_lib::naive::Naive>)`,
            '}',
        ]),
        '',
    ].join('\n')
}

/**
 * Compiles every sample into its `.rs`, in order, stopping at the first the
 * compiler refuses, then writes `mod.rs` naming them all.
 *
 * @type {(places: readonly Place[]) => Effect<_CompileOp, void, IoChannel>}
 */
export const generate = places => step(
    forEachStep(pureOk(places), ({ name, directory }) => compileFile(noRuntime)(samplePath(directory), rustPath(name))),
    () => writeFiles([[modulesPath, modules(places.map(({ name }) => name))]]))

/** @type {NodeProgram} */
export const main = _options => exitStep(generate(samples))
