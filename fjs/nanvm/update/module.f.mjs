/**
 * Writes the generated Rust operator tests.
 *
 * The printer in [`../rust/module.f.mjs`](../rust/module.f.mjs) is pure; this
 * module is the thin effectful shell around it, invoked from `ci-update` so
 * the CI drift check regenerates the file on every pull request and fails
 * when the committed copy is stale.
 *
 * @module
 */

import { mapStep, step } from '../../effects/module.f.mjs'
/** @import { Effect } from '../../effects/types.ts' */
import { mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
/** @import { Mkdir, NodeProgram, WriteFile } from '../../effects/node/types.ts' */
import { unwrap } from '../../types/result/module.f.mjs'
import { data } from '../module.f.mjs'
import { directory, generate, path } from '../rust/module.f.mjs'

/**
 * Regenerates `nanvm-lib/tests/test/generated.rs` from the shared test data.
 *
 * @type {() => Effect<Mkdir | WriteFile, void>}
 */
export const generateRustTests = () => {
    const directoryReady = mapStep(mkdir(directory, { recursive: true }), unwrap)
    const written = step(directoryReady, () => writeUtf8File(path, generate(data)))
    return mapStep(written, unwrap)
}

/** @type {NodeProgram} */
export const main = () => mapStep(generateRustTests(), () => 0)
