/**
 * The runtime as the generators and the harness need it: where
 * [`fjs/js/runtime`](../../js/runtime/module.f.js) is authored, where
 * `npm run gen` compiles it to — Rust for `nanvm-lib`, EDAG for the corpus
 * proof — and the runtime loaded from its source, for the fixture
 * expectations [`../harness`](../harness/module.f.mjs) interprets under it.
 *
 * The compiles go through [`compileFile`](../../compiler/module.f.mjs), the
 * compiler being the generator, under no runtime, since a code output
 * interprets nothing; and the load through the transpiler's `runtimeAt`,
 * which the compile command uses too, with the repository root as the
 * package the generators run from.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 * @import { Runtime } from '../../edag/value/types.ts'
 */

import { ioError, pureError, pureOk, resultStep, step } from '../../effects/module.f.mjs'
import { compileFile, noRuntime, runtimeSource } from '../../compiler/module.f.mjs'
import { runtimeAt } from '../../compiler/transpiler/module.f.mjs'

/** Where the runtime is authored, from the repository root the generators run from. */
export const source = runtimeSource('.')

/**
 * Where its Rust goes: beside the binder `vm/runtime.rs`, which includes
 * it by `#[path]`, since a `gen.` name is not a Rust identifier.
 */
export const rustPath = 'nanvm/lib/src/vm/gen.runtime.rs'

/**
 * Where its EDAG goes, beside its source, for the corpus proof
 * [`../proof.f.mjs`](../proof.f.mjs) and the compiler's demo: the consumers
 * that need the runtime as data without a file system. Nothing the compiler
 * imports reads it — `npm run gen` deletes every `gen.*` first, and a
 * generator whose own imports needed one could not start.
 */
export const edagPath = 'fjs/js/runtime/gen.edag.data.mjs'

/** Compiles the runtime to Rust, then to EDAG. @type {() => Effect<_CompileOp, void, IoChannel>} */
export const generate = () => step(compileFile(noRuntime)(source, rustPath), () => compileFile(noRuntime)(source, edagPath))

/**
 * The runtime interpreted from its source: its `runtime` export, as an
 * executor takes it. A source the interpreter cannot load, or one exporting
 * no `runtime` object, is the failure of whatever generator asked for it.
 *
 * @type {() => Effect<ReadWhole | ResolveFileModule, Runtime, IoChannel>}
 */
export const load = () => resultStep(runtimeAt(source), result => {
    const [kind, value] = result
    return kind === 'ok' ? pureOk(value) : pureError(ioError({ message: `${value.path}: ${value.message}` }))
})
