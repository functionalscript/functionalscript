/**
 * CI step builder for Bun: runs this repository's suite under the Bun its
 * generated flake provides.
 *
 * That Bun is not the pinned snapshot's. Nixpkgs ships 1.3.13, and two of this
 * repository's proofs fail on it — `customSpeciesThatFailsIsReported` in
 * `fjs/emergent_testing/browser`, where a throwing `Symbol.species` getter
 * escapes the proof instead of being reported, which is a real difference in
 * when JavaScriptCore reads that property rather than a slow machine. So the
 * flake keeps the snapshot's packaging and replaces the archive it unpacks with
 * the release named in `../config/module.f.mjs`.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { bun, bunHash } from '../config/module.f.mjs'
import { nixInstall, nixSteps, nixSystem, nixVersionStep } from '../nix/module.f.mjs'

/** CI job id, and the directory name of its generated flake. */
export const bunJobId = /** @type {const} */ ('bun')

/**
 * The archive Bun publishes for the system the generated flakes target.
 *
 * The name carries that system — `aarch64-linux` is Bun's `linux-aarch64` —
 * so it is written beside `nixSystem` rather than derived from it: a job on
 * another runner needs another archive *and* another hash, and deriving the
 * first would leave the second silently wrong.
 */
const bunArchive = `https://github.com/oven-sh/bun/releases/download/bun-v${bun}/bun-linux-aarch64.zip`

/**
 * The job's development environment: the snapshot's `bun`, with its source
 * replaced by an exact upstream release.
 *
 * `packages` is empty because the pinned package is the whole shell — the
 * generator puts it there, and adding `bun` here as well would put the
 * snapshot's 1.3.13 on `PATH` beside the one this job exists to run.
 *
 * @type {NixJob}
 */
export const bunNixJob = {
    id: bunJobId,
    system: nixSystem,
    packages: [],
    pin: {
        package: 'bun',
        version: bun,
        url: bunArchive,
        hash: bunHash,
    },
}

/**
 * The migrated job: install Nix, check the Bun its flake provides, then this
 * repository's dependencies and its suite, one step each.
 *
 * The version check earns more here than anywhere else. Every other job's check
 * confirms that a snapshot provides what the configuration claims; this one
 * confirms that an override took effect at all. A `overrideAttrs` that silently
 * failed to apply would leave the snapshot's 1.3.13 in the shell, and the two
 * failing proofs would be the way anyone found out.
 *
 * `bun --version` prints the bare version and nothing else — no leading `v`,
 * no program name — which is why the expectation is the configured string
 * unchanged.
 *
 * The job installs no `functionalscript` and runs no `bunx` smoke test. Those
 * checked a **published release** rather than the commit under review, so they
 * could only fail when an already-shipped CLI stopped working against these
 * proofs, while a regression in the CLI this commit builds stayed invisible
 * until after it shipped. `../todo/built-package-checks.md` owns that move.
 *
 * @type {readonly MetaStep[]}
 */
export const bunSteps = [
    nixInstall,
    nixVersionStep(bunJobId, 'bun --version', bun),
    ...nixSteps(bunJobId)([
        'bun install --frozen-lockfile',
        'bun test --coverage',
    ]),
]
