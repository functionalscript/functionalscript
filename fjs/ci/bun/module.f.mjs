/**
 * CI step builder for Bun: installs the pinned Bun version and runs this
 * repository's suite under it.
 *
 * This is the one canonical job still on a setup action rather than a generated
 * Nix flake. Nixpkgs does not package a Bun this repository's proofs pass on —
 * see `../todo/bun-nix-blocked-on-nixpkgs.md`, which owns the migration and
 * records what has to change first.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 */

import { bun } from '../config/module.f.mjs'
import { install, test, uses } from '../common/module.f.mjs'

/** CI job id. */
export const bunJobId = /** @type {const} */ ('bun')

/**
 * The job installs no `functionalscript` and runs no `bunx` smoke test.
 *
 * Those checked a **published release** — not the commit under review — so they
 * could only fail when an already-shipped CLI stopped working against these
 * proofs, while a regression in the CLI this commit builds stayed invisible
 * until after it shipped. Checking the built package belongs to the
 * `package-check` family, which already downloads the `npm pack` artifact;
 * `../todo/built-package-checks.md` owns that move. Node 22 lost the same pair
 * for the same reason when it migrated.
 *
 * What is left needs no version argument: every command is about this
 * repository.
 *
 * @type {readonly MetaStep[]}
 */
export const bunSteps = [
    install(uses('oven-sh/setup-bun', { 'bun-version': bun })),
    test({ run: 'bun install --frozen-lockfile' }),
    test({ run: 'bun test --coverage' }),
]
