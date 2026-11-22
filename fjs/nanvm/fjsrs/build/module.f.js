/**
 * Writes the Rust the `nanvm-fjsrs` crate links: the `fjsrs` program,
 * [`../module.f.js`](../module.f.js), compiled through the compiler's Rust
 * output into `nanvm/fjsrs/src/gen.program.native.rs`. Invoked from `gen`, so the CI
 * drift check regenerates the file on every pull request and fails when the
 * committed copy is stale.
 *
 * @module
 *
 * @import { NodeProgram } from '../../../effects/node/types.ts'
 */

import { compileFile, noRuntime } from '../../../compiler/module.f.js'
import { step } from '../../../effects/module.f.js'
import { exitStep } from '../../../effects/node/module.f.js'

/** The program's source. */
export const source = /** @type {const} */ ('fjs/nanvm/fjsrs/module.f.js')

/** Where the crate reads it, a `gen.` name `gen:clean` empties. */
export const output = /** @type {const} */ ('nanvm/fjsrs/src/gen.program.native.rs')

/** @type {NodeProgram} */
export const main = _options => exitStep(step(compileFile(noRuntime)(source, output), () =>
    compileFile(noRuntime)('nanvm/fjsrs/tests/static-strings.f.js', 'nanvm/fjsrs/tests/generated/gen.strings.native.rs')))
