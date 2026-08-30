import { bunJobId, bunSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { nixJobs } from '../module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const runs = toSteps(bunSteps).flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    // The whole job, in order: this repository's dependencies, then its suite.
    // Nothing installs or runs a published `functionalscript` — that check
    // belongs to the package job family, which can look at the tarball this
    // commit builds instead of a release that shipped weeks ago.
    steps: () => assertStructurallySame(runs, [
        'bun install --frozen-lockfile',
        'bun test --coverage',
    ]),
    noPublishedPackage: () => assert(
        !runs.some(run => run.includes('functionalscript@')),
        'unexpected published-package step'),
    // The one canonical runtime job still on a setup action, and one of three
    // with no generated flake — `fjs/ci/proof.f.mjs`'s `nixCoverage` holds that
    // whole list. Both halves are asserted here so that migrating this job has
    // to come and say so, rather than leaving it half-moved.
    notOnNix: () => {
        const used = toSteps(bunSteps).flatMap(s => s.uses !== undefined ? [s.uses] : [])
        assert(
            used.some(u => u.startsWith('oven-sh/setup-bun@')),
            'expected setup-bun while the Nixpkgs Bun fails this suite')
        assert(
            !used.some(u => u.startsWith('cachix/install-nix-action@')),
            'unexpected Nix installer in a job with no flake')
        assertEq(nixJobs.filter(job => job.id === bunJobId).length, 0)
    },
}
