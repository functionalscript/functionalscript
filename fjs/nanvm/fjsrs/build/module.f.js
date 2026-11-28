/**
 * Writes the Rust the `nanvm-fjsrs` crate links: the `fjsrs` program,
 * [`../module.f.js`](../module.f.js), compiled through the compiler's Rust
 * output into `nanvm/fjsrs/src/gen.program.native.rs`, from the module's
 * value: the program starts with its initialization already done. Invoked from `gen`, so the CI
 * drift check regenerates the file on every pull request and fails when the
 * committed copy is stale.
 *
 * @module
 *
 * @import { NodeProgram } from '../../../effects/node/types.ts'
 */

import { compileFile, noRuntime, packageRuntime } from '../../../compiler/module.f.js'
import { step } from '../../../effects/module.f.js'
import { exitStep } from '../../../effects/node/module.f.js'

/** The program's source. */
export const source = /** @type {const} */ ('fjs/nanvm/fjsrs/module.f.js')

/** Where the crate reads it, a `gen.` name `gen:clean` empties. */
export const output = /** @type {const} */ ('nanvm/fjsrs/src/gen.program.native.rs')

/** @type {NodeProgram} */
export const main = ({ packageRoot }) => exitStep(step(compileFile(packageRuntime(packageRoot))(source, output), () =>
    // the strings fixture is about what the Rust writer spells, so it is
    // written from the graph
    compileFile(noRuntime, true)('nanvm/fjsrs/tests/static-strings.f.js', 'nanvm/fjsrs/tests/generated/gen.strings.native.rs')))
