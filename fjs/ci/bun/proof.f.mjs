import { bunJobId, bunPin, bunSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { bun, bunSources } from '../config/module.f.mjs'
import { nixDevelop, nixShell, nixSystem, runPath } from '../nix/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const runs = toSteps(bunSteps).flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    // The whole job, in order: the version check, then this repository's
    // dependencies and its suite, each entering the flake. Nothing installs or
    // runs a published `functionalscript` — that check moved to the package job
    // family, which can look at the tarball this commit builds instead of a
    // release that shipped weeks ago.
    steps: () => assertStructurallySame(runs, [
        `test "$(${nixDevelop(nixShell, 'bun --version')})" = "${bun}"`,
        nixDevelop(nixShell, 'bun install --frozen-lockfile'),
        nixDevelop(nixShell, 'bun test --coverage'),
    ]),
    noPublishedPackage: () => assert(
        !runs.some(run => run.includes('functionalscript@')),
        'unexpected published-package step'),
    // No `setup-bun` survives: the runtime comes from the flake, and the only
    // action the job installs is Nix itself.
    installsNixOnly: () => {
        const used = toSteps(bunSteps).flatMap(s => s.uses !== undefined ? [s.uses] : [])
        assert(!used.some(u => u.startsWith('oven-sh/setup-bun@')), 'unexpected setup-bun')
        assert(used.some(u => u.startsWith('cachix/install-nix-action@')), 'expected the Nix installer')
    },
    // The job has no flake of its own: both commands name `bun`, so what else
    // the shared shell carries cannot decide what runs them.
    sharesTheShell: () => {
        assert(
            runs.every(run => run.includes(`${runPath(nixShell)} `)),
            `expected every command in the ${nixShell} shell`)
        assert(
            !runs.some(run => run.includes(`${runPath(bunJobId)} `)),
            'unexpected flake of its own')
    },
    // The pin covers whatever systems it is asked for, and each entry names the
    // release the job checks for and the archive that system's packaging
    // expects. Neither half is derivable from the other — Intel macOS takes a
    // baseline build — so both come from the configured table.
    pinSources: () => {
        const { sources } = bunPin(['aarch64-linux', 'x86_64-darwin'])
        for (const [system, { url, hash }] of Object.entries(sources)) {
            const configured = bunSources[system]
            assert(configured !== undefined, system)
            assertEq(hash, configured.hash)
            assertEq(
                url,
                `https://github.com/oven-sh/bun/releases/download/bun-v${bun}/${configured.archive}.zip`)
        }
        assertStructurallySame(
            Object.keys(sources),
            ['aarch64-linux', 'x86_64-darwin'])
        assertEq(bunSources['x86_64-darwin']?.archive, 'bun-darwin-x64-baseline')
        assertEq(nixSystem, 'aarch64-linux')
    },
}
