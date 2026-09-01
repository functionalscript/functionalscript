/**
 * Writes the generated Rust operator tests.
 *
 * The printer in [`../rust/module.f.mjs`](../rust/module.f.mjs) is pure; this
 * module is the thin effectful shell around it, invoked from `gen` so
 * the CI drift check regenerates the file on every pull request and fails
 * when the committed copy is stale.
 *
 * @module
 *
 * @import { IoChannel, Mkdir, NodeProgram, WriteFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */


import { exitStep, mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { step } from '../../effects/module.f.mjs'
import { data } from '../module.f.mjs'
import { directory, generate, path } from '../rust/module.f.mjs'

/**
 * Regenerates `nanvm-lib/tests/test/generated.rs` from the shared test data.
 *
 * @type {() => Effect<Mkdir | WriteFile, void, IoChannel>}
 */
export const generateRustTests = () => {
    const directoryReady = mkdir(directory, { recursive: true })
    return step(directoryReady, () => writeUtf8File(path, generate(data)))
}

/** @type {NodeProgram} */
export const main = () => exitStep(generateRustTests())
