/**
 * CI step builder for Deno: runs this repository's suite under the Deno the
 * shared flake provides.
 *
 * Coverage runs through `deno task cov`, so `deno.json` owns the permission set
 * and the coverage filter, exactly as `npm run cov` leaves them to
 * `package.json` for the Node jobs. The two `cov` definitions select the same
 * modules and should stay semantically equal.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 */

import { deno } from '../config/module.f.mjs'
import { nixInstall, nixShell, nixSteps, nixVersionStep } from '../nix/module.f.mjs'

/** CI job id, and the directory name of its generated flake. */
export const denoJobId = /** @type {const} */ ('deno')

/**
 * Deno prints three lines for `--version` — the runtime, V8 and TypeScript — so
 * comparing the whole output would pin two versions this repository does not
 * configure. `Deno.version.deno` is the one field, on one line.
 *
 * `pkgs.deno` carries no version in its name, so this check is the whole tie
 * between `../config/module.f.mjs` and what the shell provides — and it is the
 * only one, since the shared shell has no job of its own to re-check it.
 */
const denoVersionStep = nixVersionStep(
    nixShell,
    `deno eval 'console.log(Deno.version.deno)'`,
    deno)

/**
 * The migrated job: install Nix, check the Deno the shared flake provides, then
 * this repository's own dependencies and suite, one `nix develop` step each.
 *
 * Every command names `deno`, which is why this job can share a shell with the
 * others: nothing here is resolved from `PATH`, so a Node or a Bun beside it
 * changes nothing about what runs.
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
    ...nixSteps(nixShell)([
        'deno install --frozen',
        'deno task cov',
    ]),
]
