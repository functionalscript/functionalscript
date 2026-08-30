import { denoJobId, denoSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { deno } from '../config/module.f.mjs'
import { nixDevelop, nixShell, runPath } from '../nix/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const runs = toSteps(denoSteps).flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    // The whole job, in order: the version check, then this repository's
    // dependencies and its suite, each entering the flake. Nothing installs or
    // runs a published `functionalscript` — that check moved to the package job
    // family, which can look at the tarball this commit builds instead of a
    // release that shipped weeks ago.
    steps: () => assertStructurallySame(runs, [
        `test "$(${nixDevelop(nixShell, `deno eval 'console.log(Deno.version.deno)'`)})" = "${deno}"`,
        nixDevelop(nixShell, 'deno install --frozen'),
        nixDevelop(nixShell, 'deno task cov'),
    ]),
    // A regression guard: the job must delegate coverage to `deno.json`'s `cov`
    // task. Inlining the command here instead would give the coverage filter a
    // second owner that can silently drift from `deno.json`.
    coverageStep: () => {
        const found = runs.filter(run => run.includes('cov'))
        assertEq(found.length, 1)
        const [run] = found
        assertEq(run, nixDevelop(nixShell, 'deno task cov'))
    },
    noPublishedPackage: () => {
        assert(
            !runs.some(run => run.includes('functionalscript@')),
            'unexpected published-package step')
        // The flag existed only to let a registry install take a package
        // younger than Deno's 24-hour default. No registry install is left.
        assert(
            !runs.some(run => run.includes('--minimum-dependency-age')),
            'unexpected dependency-age flag with no registry install')
    },
    // No `setup-deno` survives: the runtime comes from the flake, and the only
    // action the job installs is Nix itself.
    installsNixOnly: () => {
        const used = toSteps(denoSteps).flatMap(s => s.uses !== undefined ? [s.uses] : [])
        assert(!used.some(u => u.startsWith('denoland/setup-deno@')), 'unexpected setup-deno')
        assert(used.some(u => u.startsWith('cachix/install-nix-action@')), 'expected the Nix installer')
    },
    // The job has no flake of its own: `deno` is named on every command line
    // here, so what else the shared shell carries cannot decide what runs.
    // `../dev/proof.f.mjs` is where that shell is held to providing a `deno`.
    sharesTheShell: () => {
        assert(
            runs.every(run => run.includes(`${runPath(nixShell)} `)),
            `expected every command in the ${nixShell} shell`)
        assert(
            !runs.some(run => run.includes(`${runPath(denoJobId)} `)),
            'unexpected flake of its own')
    },
}
