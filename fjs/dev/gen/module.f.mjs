/**
 * `npm run gen`: every generated output of this repository regenerated from
 * nothing, as one program. {@link generators} is the regeneration, in the
 * order it needs, with the reason for each position beside it; a new generated
 * output is a new entry there and nothing else. The lock script that ends it
 * is {@link lock}.
 *
 * A program rather than the shell chain `package.json` used to hold: a chain
 * names each generator a second time by path, cannot say why its order is
 * what it is, and has no proof. This module imports each generator's `main`,
 * so a move or rename is a compile error rather than a broken chain found at
 * run time. The npm script keeps its name — `gen` is the contract the
 * generated workflow runs
 * ([CONTRIBUTING.md](../../../CONTRIBUTING.md#regenerating-after-a-source-change)).
 *
 * @module
 *
 * @import { ExitStatus, NodeOp, NodeProgram, Write } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 */

import { errorMessage, foldStep, pureOk, resultStep, step } from '../../effects/module.f.mjs'
import { childWait, errorExit, spawn } from '../../effects/node/module.f.mjs'
import { lockUpdatePath } from '../../ci/nix/module.f.mjs'
import { main as clean } from '../clean/module.f.mjs'
import { main as ci } from '../../ci/self/module.f.mjs'
import { main as rustTests } from '../../nanvm/update/module.f.mjs'
import { main as matrix } from '../../media/datajs/vectors/matrix/module.f.mjs'
import { main as fixtures } from '../../nanvm/harness/module.f.mjs'

/**
 * The generators, in the order regeneration needs. Each is a `NodeProgram`
 * that writes its outputs and answers an exit code, so the sequence stops at
 * the first that fails, as `&&` did, and the message naming the failure is
 * the generator's own.
 *
 * @type {readonly NodeProgram[]}
 */
export const generators = [
    // Cleanup first: every `gen.*` deleted, so regeneration starts from
    // nothing — an output no generator writes any more shows up as a
    // deletion, and a generator that needs a previous output, its own or
    // another's, fails.
    clean,
    // The CI workflows and the Nix flakes. Writes `gen.nix/`, whose flakes the
    // lock step at the end locks, so it must precede that step.
    ci,
    // The NaNVM Rust test corpus, methods table and values fixture, from the
    // shared test data.
    rustTests,
    // The DataJS class-by-role matrix from the vector corpus, with the check
    // that each set's source is the document it denotes.
    matrix,
    // The `nanvm-harness` fixtures compiled to Rust, and the `mod.rs` naming
    // them: the fixture directory is the list.
    fixtures,
]

/**
 * Runs `programs` in order, each with the same options, stopping at the first
 * nonzero exit code and answering it; `0` once every one has answered `0`.
 *
 * @type {(programs: readonly NodeProgram[]) => NodeProgram}
 */
export const sequence = programs => options =>
    foldStep(pureOk(programs), /** @type {0} */ (0), program => () => program(options))

/**
 * What the lock script's ending means for the program: `0` for an exit of
 * `0`, and otherwise a failure naming the script and how it ended — a
 * signaled child has no code, so the signal is what is named.
 *
 * @type {(status: ExitStatus) => Effect<Write, 0, number>}
 */
export const lockEnded = ([tag, value]) => {
    // Bound rather than returned inline, as `exitStep` binds its branches:
    // `step` infers its continuation's type from the union and picks neither.
    /** @type {Effect<Write, 0, number>} */
    const code = tag === 'exited' && value === 0
        ? pureOk(0)
        : errorExit(`${lockUpdatePath}: ${tag === 'exited' ? `exit code ${value}` : `killed by ${value}`}`)
    return code
}

/**
 * The last step: the generated lock script, which locks each flake from its
 * pinned commit, run on this process's terminal so that what Nix prints
 * reaches the reader as it is printed and in order. A `spawn` rather than an
 * `exec` for exactly that — `exec` buffers both streams until the child exits
 * and drops them on a nonzero exit. A script that could not start is the
 * host's failure; one that ran is {@link lockEnded}'s to judge.
 *
 * @type {Effect<NodeOp, 0, number>}
 */
export const lock = resultStep(
    step(spawn('sh', [lockUpdatePath], { stdio: 'inherit' }), childWait),
    result => {
        /** @type {Effect<Write, 0, number>} */
        const code = result[0] === 'error' ? errorExit(errorMessage(result[1])) : lockEnded(result[1])
        return code
    })

/** @type {NodeProgram} */
export const main = options => step(sequence(generators)(options), () => lock)
