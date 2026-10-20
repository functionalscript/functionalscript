/**
 * What it means for an all-Nix CI job to have migrated onto the shared shell,
 * stated once for every proof that holds a job to it.
 *
 * The contract is the Bun/Deno-style job's, not every migration's: the
 * migrated Node job deliberately runs its generated-file check
 * (`git add -A && git diff --cached --exit-code`) runner-native, and
 * `sharesTheShell` would reject it. A mixed-style job adopts these checks
 * only with an explicit allow-list of the runner-native commands it may run,
 * never with a looser `sharesTheShell`.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 */

import { toSteps } from '../common/module.f.mjs'
import { runPath } from './module.f.mjs'
import { assert } from '../../asserts/module.f.js'

/**
 * The commands a job runs, in order.
 *
 * @type {(steps: readonly MetaStep[]) => readonly string[]}
 */
export const _runs = steps => toSteps(steps).flatMap(s => s.run !== undefined ? [s.run] : [])

/**
 * The proof rows every all-Nix migrated job shares. `retiredAction` is the
 * `setup-<tool>` action the flake replaced, such as `oven-sh/setup-bun`.
 *
 * @type {(job: { readonly steps: readonly MetaStep[], readonly retiredAction: string }) => {
 *     readonly noPublishedPackage: () => void,
 *     readonly installsNixOnly: () => void,
 *     readonly sharesTheShell: () => void,
 * }}
 */
export const _migratedJobChecks = ({ steps, retiredAction }) => {
    const runs = _runs(steps)
    return {
        // Nothing installs or runs a published `functionalscript`.
        noPublishedPackage: () => assert(
            !runs.some(run => run.includes('functionalscript@')),
            'unexpected published-package step'),
        // No `setup-<tool>` survives: the runtime comes from the flake, and the
        // only action the job installs is Nix itself.
        installsNixOnly: () => {
            const used = toSteps(steps).flatMap(s => s.uses !== undefined ? [s.uses] : [])
            assert(!used.some(u => u.startsWith(`${retiredAction}@`)), `unexpected ${retiredAction}`)
            assert(used.some(u => u.startsWith('cachix/install-nix-action@')), 'expected the Nix installer')
        },
        // Every command enters the shared shell; the job has no flake of its own.
        sharesTheShell: () => assert(
            runs.every(run => run.includes(`${runPath()} `)),
            'expected every command in the shared shell'),
    }
}
