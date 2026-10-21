/**
 * Writes the Rust of the WASM demo pages' samples
 * ([`todo/wasm-demos.md`](../../../todo/wasm-demos.md)): each sample's
 * `sample.f.mjs` compiled through the compiler's Rust output into
 * `nanvm/demos/gen.samples/<name>.rs`, and `gen.samples/mod.rs` naming each.
 * The `nanvm-demos` crate reaches the set through one `#[path]` to that
 * `mod.rs`, and builds it for `wasm32` in the deployment build.
 *
 * Invoked from `gen`, so the drift check fails when a committed `.rs` is
 * stale. The samples are listed by name, not found by a walk: each one also
 * needs an entry in the crate and a demo page, so a new sample is never one
 * file.
 *
 * @module
 *
 * @import { IoChannel, NodeProgram } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 */

import { compileFile, noRuntime } from '../../compiler/module.f.mjs'
import { forEachStep, pureOk, step } from '../../effects/module.f.mjs'
import { exitStep, writeFiles } from '../../effects/node/module.f.mjs'
import { generatedHeader } from '../../media/rust/item/module.f.js'
import { cmp } from '../../types/string/module.f.mjs'
import { rustDirectory, rustPath, samplePath } from './page/module.f.mjs'

export { rustPath, samplePath }

/** The samples, by the name of the directory beside this module that holds each. */
export const samples = ['hello', 'sort', 'collatz']

/** The module file naming every compiled sample, which `src/lib.rs` includes by path. */
export const modulesPath = `${rustDirectory}/mod.rs`

/**
 * The text of `mod.rs`: one `pub mod` per sample, under the header every
 * generated file carries. Sorted with `string.cmp`, the order `rustfmt` puts
 * `mod` lines in, so `cargo fmt --check` passes whatever order `samples`
 * lists them in.
 *
 * @type {(names: readonly string[]) => string}
 */
export const modules = names => [
    generatedHeader('`fjs run ./fjs/nanvm/demos/module.f.mjs`', 'add or remove a sample instead'),
    '',
    ...names.toSorted((a, b) => cmp(a)(b)).map(name => `pub mod ${name};`),
    '',
].join('\n')

/**
 * Compiles every sample into its `.rs`, in order, stopping at the first the
 * compiler refuses, then writes `mod.rs` naming them all.
 *
 * @type {(names: readonly string[]) => Effect<_CompileOp, void, IoChannel>}
 */
export const generate = names => step(
    forEachStep(pureOk(names), name => compileFile(noRuntime)(samplePath(name), rustPath(name))),
    () => writeFiles([[modulesPath, modules(names)]]))

/** @type {NodeProgram} */
export const main = _options => exitStep(generate(samples))
