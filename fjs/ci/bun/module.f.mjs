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
 * @import { NixPin } from '../nix/types.ts'
 */

import { bun, bunSources } from '../config/module.f.mjs'
import { nixInstall, nixShell, nixSteps, nixVersionStep } from '../nix/module.f.mjs'
import { fromUndefined, unwrap as unwrapNullable } from '../../types/nullable/module.f.mjs'

/** CI job id, and the directory name of its generated flake. */
export const bunJobId = /** @type {const} */ ('bun')

/**
 * The override the shared flake declares, over the systems it targets.
 *
 * It lives here rather than beside that flake because it is knowledge about
 * Bun: which archive each system takes, and why Intel macOS takes a baseline
 * build. `../dev/module.f.mjs` asks for it by name and stays free of all of
 * that.
 *
 * The archive name and the hash travel together out of `../config/module.f.mjs`.
 * Deriving the name from the system while looking the hash up separately is
 * exactly how the two would come apart — and the names are not derivable
 * anyway, since Intel macOS takes a baseline build the others do not.
 *
 * @type {(systems: readonly string[]) => NixPin}
 */
export const bunPin = systems => ({
    package: 'bun',
    version: bun,
    sources: Object.fromEntries(systems.map(system => {
        const { archive, hash } = unwrapNullable(fromUndefined(bunSources[system]))
        return [
            system,
            {
                url: `https://github.com/oven-sh/bun/releases/download/bun-v${bun}/${archive}.zip`,
                hash,
            },
        ]
    })),
})

/**
 * The migrated job: install Nix, check the Bun the shared flake provides, then
 * this repository's dependencies and its suite, one step each.
 *
 * Both commands name `bun`, so sharing a shell with the other jobs changes
 * nothing about which runtime runs them.
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
    nixVersionStep(nixShell, 'bun --version', bun),
    ...nixSteps(nixShell)([
        'bun install --frozen-lockfile',
        'bun test --coverage',
    ]),
]
