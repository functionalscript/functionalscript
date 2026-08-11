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

import { mapStep, step } from '../../../fjs/effects/module.f.mjs'

import type { Effect } from '../../../fjs/effects/types.ts'

import type {
    Mkdir,
    NodeProgram,
    WriteFile,
} from '../../../fjs/effects/node/types.ts'
import { mkdir, writeUtf8File } from '../../../fjs/effects/node/module.f.mjs'

import { unwrap } from '../../../fjs/types/result/module.f.mjs'

import { data } from '../module.f.mjs'

import { directory, generate, path } from '../rust/module.f.mjs'

/** Regenerates `nanvm-lib/tests/test/generated.rs` from the shared test data. */
export const generateRustTests = (): Effect<Mkdir | WriteFile, void> => {
    const directoryReady = mapStep(mkdir(directory, { recursive: true }), unwrap)
    const written = step(directoryReady, () => writeUtf8File(path, generate(data)))
    return mapStep(written, unwrap)
}

export const main: NodeProgram = () => mapStep(generateRustTests(), () => 0)
