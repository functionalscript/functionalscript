/**
 * The self-compile check: the compiler written as FunctionalScript compiles
 * itself to the same text.
 *
 * `fjs compile` writes the whole compiler as one module, that module run as
 * `fjs` writes it again, and the two files are the same bytes. A writer that
 * changes what a program means writes a compiler that writes something else,
 * so this is every pass of the writer checked on the largest program there
 * is, by what it says and not by a case someone thought of.
 *
 * The compiler is the program compiled, so the two writes are of one
 * checkout: comparing a file written before a change with one written after
 * it compares two programs.
 *
 * The two writes are compared by `git diff --no-index`, the tool the same job
 * already compares the generated files with. The commands are exported so
 * that the successful-check cache names the check by them, and not by a copy
 * of their text.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 */

import { test } from '../common/module.f.js'
import { environmentSteps } from '../environment/module.f.js'

/** Outside the checkout, which a later step of the job compares with what is committed. */
const directory = /** @type {const} */ ('"$RUNNER_TEMP/self"')

const first = /** @type {const} */ (`${directory}/first.f.js`)

const second = /** @type {const} */ (`${directory}/second.f.js`)

/** The command that makes the directory the two writes go to. */
export const prepare = /** @type {const} */ (`mkdir ${directory}`)

/** The compiler written by the checkout, then by what that wrote, run as `fjs`. */
export const writes = /** @type {const} */ ([
    `npm start c ./fjs/module.f.js ${first}`,
    `npm start r ${first} c ./fjs/module.f.js ${second}`,
])

/** The check's terminal work: the two writes are the same bytes. */
export const compare = /** @type {const} */ (`git diff --no-index --exit-code --stat ${first} ${second}`)

/** @type {readonly MetaStep[]} */
export const selfCompileSteps = [
    test({ run: prepare }),
    ...environmentSteps(writes),
    test({ run: compare }),
]
