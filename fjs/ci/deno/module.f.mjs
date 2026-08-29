/**
 * CI step builder for Deno: runs the FunctionalScript package smoke test plus
 * Deno coverage in one canonical job, on the Deno its generated flake provides.
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
import { nixInstall, nixSteps, nixSystem, nixVersionStep } from '../nix/module.f.mjs'

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
    system: nixSystem,
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
 * The migrated job: install Nix, check the Deno its flake provides, then the
 * job's existing commands in their existing order, one `nix develop` step each.
 *
 * Every command needs Deno, so every one of them enters the shell. That is also
 * why the global install is no longer an `install`-typed step: those run before
 * `actions/checkout`, and there is no `nix/deno` to enter until the repository
 * is on disk. It warms the module cache for the `deno run` below either way —
 * neither step uses the installed launcher, both name the same specifier.
 *
 * @type {(version: string) => readonly MetaStep[]}
 */
export const denoSteps = version => [
    nixInstall,
    denoVersionStep,
    ...nixSteps(denoJobId)([
        // We need --minimum-dependency-age=0 for functionalscript because we would like to use
        // the latest version of the package even if it is not yet 24 hours old,
        // which is the default minimum dependency age for Deno installs.
        // This way we can test the latest version of the package in CI without waiting for 24 hours.
        `deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${version}`,
        `deno run -A --minimum-dependency-age=0 npm:functionalscript@${version} test`,
        'deno install --frozen',
        'deno task cov',
    ]),
]
