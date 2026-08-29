import { bunJobId, bunNixJob, bunSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { bun } from '../config/module.f.mjs'
import { nixDevelop, nixSystem } from '../nix/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(version: string) => readonly string[]} */
const runs = version =>
    toSteps(bunSteps(version))
        .flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    // A regression guard matching Deno's: coverage is Bun's own flag, not a
    // filter this module spells out and can drift from.
    coverageStep: () => {
        const found = runs('0.0.0').filter(run => run.includes('--coverage'))
        assertEq(found.length, 1)
        const [run] = found
        assertEq(run, nixDevelop(bunJobId, 'bun test --coverage'))
    },
    installsPinnedVersion: () => {
        const found = runs('1.2.3').filter(run => run.includes('functionalscript@'))
        assertEq(found.length, 2)
        assert(found.every(r => r.includes('functionalscript@1.2.3')))
    },
    // Every command the job runs needs Bun, so every one of them enters the
    // flake — including the global install, which is why it is no longer an
    // `install`-typed step ahead of the checkout that puts the flake on disk.
    everyCommandEntersTheFlake: () => {
        const [check, ...rest] = runs('1.2.3')
        assertEq(check, `test "$(${nixDevelop(bunJobId, 'bun --version')})" = ${bun}`)
        for (const run of rest) {
            assert(
                run.startsWith(`nix develop --no-write-lock-file ./nix/${bunJobId} --command `),
                run)
        }
    },
    // No `setup-bun` survives: the runtime comes from the flake, and the only
    // action the job installs is Nix itself.
    installsNixOnly: () => {
        const used = toSteps(bunSteps('1.2.3'))
            .flatMap(s => s.uses !== undefined ? [s.uses] : [])
        assert(!used.some(u => u.startsWith('oven-sh/setup-bun@')), 'unexpected setup-bun')
        assert(used.some(u => u.startsWith('cachix/install-nix-action@')), 'expected the Nix installer')
    },
    nixJob: () => {
        assertEq(bunNixJob.id, bunJobId)
        assertEq(bunNixJob.system, nixSystem)
        // One unversioned attribute, so the job's version check is the only
        // thing tying `fjs/ci/config`'s `bun` to what the shell provides.
        assertEq(bunNixJob.packages.length, 1)
        assertEq(bunNixJob.packages[0], 'bun')
        assertEq(bunNixJob.shellHook, undefined)
    },
}
