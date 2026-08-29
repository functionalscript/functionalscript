/**
 * CI step builder for Bun: runs the FunctionalScript package smoke test plus
 * Bun coverage in one canonical job, on the Bun its generated flake provides.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { bun } from '../config/module.f.mjs'
import { nixInstall, nixSteps, nixSystem, nixVersionStep } from '../nix/module.f.mjs'

/** CI job id, and the directory name of its generated flake. */
export const bunJobId = /** @type {const} */ ('bun')

/**
 * The job's development environment: one `pkgs.bun` from the pinned snapshot.
 * `bunx` comes with it — the derivation links it beside `bun` — so the smoke
 * test needs nothing else.
 *
 * Unlike Node's, the attribute name carries no version, so nothing about it
 * ties `../config/module.f.mjs`'s `bun` to what the shell provides — the job's
 * version check is the whole of that tie.
 *
 * @type {NixJob}
 */
export const bunNixJob = {
    id: bunJobId,
    system: nixSystem,
    packages: ['bun'],
}

/** `bun --version` prints the version alone, with no leading `v`. */
const bunVersionStep = nixVersionStep(bunJobId, 'bun --version', bun)

/**
 * The migrated job: install Nix, check the Bun its flake provides, then the
 * job's existing commands in their existing order, one `nix develop` step each.
 *
 * Every command needs Bun, so every one of them enters the shell. That is also
 * why the global install is no longer an `install`-typed step: those run before
 * `actions/checkout`, and there is no `nix/bun` to enter until the repository
 * is on disk. It warms the cache for the `bunx` below either way — neither step
 * runs the installed launcher, both name the same version.
 *
 * The global install needs no `shellHook`, unlike the `npm install -g` Node 22
 * used to make: Bun installs into `$BUN_INSTALL` under the home directory,
 * while npm's default prefix is the Node package itself, in the read-only
 * store.
 *
 * @type {(version: string) => readonly MetaStep[]}
 */
export const bunSteps = version => [
    nixInstall,
    bunVersionStep,
    ...nixSteps(bunJobId)([
        `bun install -g functionalscript@${version}`,
        'bun install --frozen-lockfile',
        `bunx functionalscript@${version} test`,
        'bun test --coverage',
    ]),
]
