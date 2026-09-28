/**
 * Writes the generated Rust tests.
 *
 * The printer in [`../rust/module.f.mjs`](../rust/module.f.mjs) is pure; this
 * module is the thin effectful shell around it, invoked from `gen` so
 * the CI drift check regenerates the files on every pull request and fails
 * when a committed copy is stale.
 *
 * @module
 *
 * @import { IoChannel, Mkdir, NodeProgram, WriteFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */


import { exitStep, mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { forEachStep, pureOk, step } from '../../effects/module.f.mjs'
import { data } from '../module.f.mjs'
import { directory, generate } from '../rust/module.f.mjs'
import { directory as methodsDirectory, generate as generateMethods, path as methodsPath } from '../methods/module.f.mjs'

/**
 * Regenerates `nanvm-lib/tests/test/gen.corpus/` from the shared test data,
 * one file at a time, stopping at the first that fails, and then the
 * completeness table `nanvm-lib/src/vm/lambda/gen.methods.rs`.
 *
 * @type {() => Effect<Mkdir | WriteFile, void, IoChannel>}
 */
export const generateRustTests = () => {
    const directoryReady = mkdir(directory, { recursive: true })
    const corpus = step(directoryReady, () => forEachStep(
        pureOk(generate(data)),
        ([name, content]) => writeUtf8File(`${directory}/${name}`, content)))
    const methodsReady = step(corpus, () => mkdir(methodsDirectory, { recursive: true }))
    return step(methodsReady, () => writeUtf8File(methodsPath, generateMethods()))
}

/** @type {NodeProgram} */
export const main = () => exitStep(generateRustTests())
