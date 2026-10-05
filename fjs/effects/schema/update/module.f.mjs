/**
 * Writes the generated Rust operations of `nanvm-effects-node`.
 *
 * The printer in [`../rust/module.f.mjs`](../rust/module.f.mjs) is pure; this
 * module is the thin effectful shell around it, invoked from `gen` so the CI
 * drift check regenerates the file on every pull request and fails when the
 * committed copy is stale.
 *
 * @module
 *
 * @import { IoChannel, Mkdir, NodeProgram, Rm, WriteBytes, WriteFile } from '../../node/types.ts'
 * @import { Effect } from '../../types.ts'
 */

import { exitStep, mkdir, writeUtf8File } from '../../node/module.f.mjs'
import { step } from '../../module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { generate } from '../rust/module.f.mjs'

/** Where the generated file goes, in the crate that includes it. */
export const directory = 'nanvm-effects-node/src'

/** The generated file. */
export const path = `${directory}/gen.operations.rs`

/**
 * Regenerates the file from the schemas.
 *
 * @type {() => Effect<Mkdir | Rm | WriteBytes | WriteFile, void, IoChannel>}
 */
export const generateOperations = () =>
    step(mkdir(directory, { recursive: true }), () => writeUtf8File(path, unwrap(generate())))

/** @type {NodeProgram} */
export const main = () => exitStep(generateOperations())
