/**
 * Writes the generated Rust tests, and the runtime compiled for the VM.
 *
 * The printer in [`../rust/module.f.mjs`](../rust/module.f.mjs) is pure; this
 * module is the thin effectful shell around it, invoked from `gen` so
 * the CI drift check regenerates the files on every pull request and fails
 * when a committed copy is stale.
 *
 * @module
 *
 * @import { IoChannel, NodeProgram } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 */


import { exitStep, writeFiles } from '../../effects/node/module.f.mjs'
import { step } from '../../effects/module.f.mjs'
import { data } from '../module.f.mjs'
import { directory, generate } from '../rust/module.f.mjs'
import { generate as generateCommands, path as commandsPath } from '../commands/module.f.mjs'
import { generate as generateMethods, path as methodsPath } from '../methods/module.f.mjs'
import { generate as generateValues, path as valuesPath } from '../values/module.f.mjs'
import { generate as generateDeferredTailCalls, path as deferredTailCallsPath } from '../fast/deferred_owning_tail_calls/module.f.mjs'
import { generate as generateRuntime } from '../runtime/module.f.mjs'

/**
 * The Rust files {@link generateRustTests} writes before the runtime, in
 * order: the corpus, one file per group, then the completeness table, the
 * interpreted-value and raw-FAST fixtures, and the command set.
 *
 * @type {() => readonly (readonly [path: string, text: string])[]}
 */
const rustFiles = () => [
    ...generate(data).map(([name, content]) => /** @type {const} */ ([`${directory}/${name}`, content])),
    [methodsPath, generateMethods()],
    [valuesPath, generateValues()],
    [deferredTailCallsPath, generateDeferredTailCalls()],
    [commandsPath, generateCommands()],
]

/**
 * Regenerates `nanvm/lib/tests/test/gen.corpus/` from the shared test data,
 * one file at a time, stopping at the first that fails, and then the
 * completeness table `nanvm/lib/src/vm/lambda/gen.methods.rs` and interpreted
 * value fixture `nanvm/harness/gen.values/captures.rs`, the raw deferred-call
 * fixture `nanvm/harness/gen.fast/deferred_owning_tail_calls.rs`, the command set
 * `nanvm/effects-node/src/gen.commands.rs`, and the runtime compiled for
 * `nanvm-lib` and as EDAG ([`../runtime`](../runtime/module.f.mjs)).
 *
 * @type {() => Effect<_CompileOp, void, IoChannel>}
 */
export const generateRustTests = () => step(writeFiles(rustFiles()), generateRuntime)

/** @type {NodeProgram} */
export const main = () => exitStep(generateRustTests())
