/**
 * Writes the generated Rust operator tests.
 *
 * The printer in [`../rust/module.f.mjs`](../rust/module.f.mjs) is pure; this
 * module is the thin effectful shell around it, invoked from `ci-update` so
 * the CI drift check regenerates the file on every pull request and fails
 * when the committed copy is stale.
 *
 * @module
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { Mkdir, NodeProgram, WriteFile } from '../../effects/node/types.ts'
 */

import { mapStep, step } from '../../effects/module.f.mjs'
import { mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { unwrapStep } from '../../effects/io/module.f.mjs'
import { data } from '../module.f.mjs'
import { directory, generate, path } from '../rust/module.f.mjs'

/**
 * Regenerates `nanvm-lib/tests/test/generated.rs` from the shared test data.
 *
 * @type {() => Effect<Mkdir | WriteFile, void>}
 */
export const generateRustTests = () => {
    const directoryReady = unwrapStep(mkdir(directory, { recursive: true }))
    const written = step(directoryReady, () => writeUtf8File(path, generate(data)))
    return unwrapStep(written)
}

/** @type {NodeProgram} */
export const main = () => mapStep(generateRustTests(), () => 0)
