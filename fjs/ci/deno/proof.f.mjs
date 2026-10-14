import { denoSteps } from './module.f.mjs'
import { deno } from '../config/module.f.js'
import { nixDevelop } from '../nix/module.f.mjs'
import { _migratedJobChecks, _runs } from '../nix/testlib.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const runs = _runs(denoSteps)

export const proof = {
    // The whole job, in order: the version check, then this repository's
    // dependencies and its suite, each entering the flake. Nothing installs or
    // runs a published `functionalscript`. That check is owed beside the
    // packed-package check (`../todo/built-package-checks.md`), where it can
    // look at the tarball this commit builds instead of a release that shipped
    // weeks ago.
    steps: () => assertStructurallySame(runs, [
        `test "$(${nixDevelop(`deno eval 'console.log(Deno.version.deno)'`)})" = "${deno}"`,
        nixDevelop('deno install --frozen'),
        nixDevelop('deno task cov'),
    ]),
    // A regression guard: the job must delegate coverage to `deno.json`'s `cov`
    // task. Inlining the command here instead would give the coverage filter a
    // second owner that can silently drift from `deno.json`.
    coverageStep: () => {
        const found = runs.filter(run => run.includes('cov'))
        assertEq(found.length, 1)
        const [run] = found
        assertEq(run, nixDevelop('deno task cov'))
    },
    // The flag existed only to let a registry install take a package
    // younger than Deno's 24-hour default. No registry install is left.
    noDependencyAgeFlag: () => assert(
        !runs.some(run => run.includes('--minimum-dependency-age')),
        'unexpected dependency-age flag with no registry install'),
    // The all-Nix migration's contract. The job has no flake of its own: `deno`
    // is named on every command line here, so what else the shared shell
    // carries cannot decide what runs. `../dev/proof.f.mjs` is where that
    // shell is held to providing a `deno`.
    ..._migratedJobChecks({ steps: denoSteps, retiredAction: 'denoland/setup-deno' }),
}
