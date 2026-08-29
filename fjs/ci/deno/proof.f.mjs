import { denoJobId, denoNixJob, denoSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { deno } from '../config/module.f.mjs'
import { nixDevelop, nixSystem } from '../nix/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(version: string) => readonly string[]} */
const runs = version =>
    toSteps(denoSteps(version))
        .flatMap(s => s.run !== undefined ? [s.run] : [])

/** @type {(version: string) => readonly string[]} */
const coverageRuns = version =>
    runs(version).filter(run => run.includes('cov'))

export const proof = {
    // A regression guard: the job must delegate coverage to `deno.json`'s `cov`
    // task. Inlining the command here instead would give the coverage filter a
    // second owner that can silently drift from `deno.json`.
    coverageStep: () => {
        const found = coverageRuns('0.0.0')
        assertEq(found.length, 1)
        const [run] = found
        assertEq(run, nixDevelop(denoJobId, 'deno task cov'))
    },
    installsPinnedVersion: () => {
        const found = runs('1.2.3').filter(run => run.includes('npm:functionalscript@'))
        assertEq(found.length, 2)
        assert(found.every(r => r.includes('npm:functionalscript@1.2.3')))
    },
    // Every command the job runs needs Deno, so every one of them enters the
    // flake — including the global install, which is why it is no longer an
    // `install`-typed step ahead of the checkout that puts the flake on disk.
    everyCommandEntersTheFlake: () => {
        const [check, ...rest] = runs('1.2.3')
        assertEq(
            check,
            `test "$(${nixDevelop(denoJobId, `deno eval 'console.log(Deno.version.deno)'`)})" = ${deno}`)
        for (const run of rest) {
            assert(
                run.startsWith(`nix develop --no-write-lock-file ./nix/${denoJobId} --command `),
                run)
        }
    },
    // No `setup-deno` survives: the runtime comes from the flake, and the only
    // action the job installs is Nix itself.
    installsNixOnly: () => {
        const used = toSteps(denoSteps('1.2.3'))
            .flatMap(s => s.uses !== undefined ? [s.uses] : [])
        assert(!used.some(u => u.startsWith('denoland/setup-deno@')), 'unexpected setup-deno')
        assert(used.some(u => u.startsWith('cachix/install-nix-action@')), 'expected the Nix installer')
    },
    nixJob: () => {
        assertEq(denoNixJob.id, denoJobId)
        assertEq(denoNixJob.system, nixSystem)
        // One unversioned attribute, so the job's version check is the only
        // thing tying `fjs/ci/config`'s `deno` to what the shell provides.
        assertEq(denoNixJob.packages.length, 1)
        assertEq(denoNixJob.packages[0], 'deno')
        assertEq(denoNixJob.shellHook, undefined)
    },
}
