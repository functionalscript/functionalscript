/**
 * CI step builder for Deno: runs this repository's suite under the Deno its
 * generated flake provides.
 *
 * Coverage runs through `deno task cov`, so `deno.json` owns the permission set
 * and the coverage filter, exactly as `npm run cov` leaves them to
 * `package.json` for the Node jobs. The two `cov` definitions select the same
 * modules and should stay semantically equal.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { deno } from '../config/module.f.mjs'
import { nixInstall, nixSteps, nixSystems, nixVersionStep } from '../nix/module.f.mjs'

/** CI job id, and the directory name of its generated flake. */
export const denoJobId = /** @type {const} */ ('deno')

/**
 * The job's development environment: one `pkgs.deno` from the pinned snapshot.
 *
 * Unlike Node's, the attribute name carries no version, so nothing about it
 * ties `../config/module.f.mjs`'s `deno` to what the shell provides — the
 * job's version check is the whole of that tie.
 *
 * @type {NixJob}
 */
export const denoNixJob = {
    id: denoJobId,
    systems: nixSystems,
    packages: ['deno'],
}

/**
 * Deno prints three lines for `--version` — the runtime, V8 and TypeScript — so
 * comparing the whole output would pin two versions this repository does not
 * configure. `Deno.version.deno` is the one field, on one line.
 */
const denoVersionStep = nixVersionStep(
    denoJobId,
    `deno eval 'console.log(Deno.version.deno)'`,
    deno)

/**
 * The migrated job: install Nix, check the Deno its flake provides, then this
 * repository's own dependencies and suite, one `nix develop` step each.
 *
 * It installs no `functionalscript` and runs no `deno run npm:functionalscript`
 * smoke test. Those checked a **published release** — not the commit under
 * review — so they could only fail when an already-shipped CLI stopped working
 * against these proofs, while a regression in the CLI this commit builds stayed
 * invisible until after it shipped. Checking the built package belongs to the
 * `package-check` family, which already downloads the `npm pack` artifact;
 * `../todo/built-package-checks.md` owns that move. The `bun` job and Node 22
 * lost the same pair for the same reason.
 *
 * `--minimum-dependency-age=0` went with them. It existed to let a registry
 * install take a package younger than Deno's 24-hour default, and nothing here
 * installs from the registry any more.
 *
 * What is left needs no version argument: every command is about this
 * repository.
 *
 * @type {readonly MetaStep[]}
 */
export const denoSteps = [
    nixInstall,
    denoVersionStep,
    ...nixSteps(denoJobId)([
        'deno install --frozen',
        'deno task cov',
    ]),
]
