import { bunJobId, bunNixJob, bunPin, bunSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { bun, bunSources } from '../config/module.f.mjs'
import { nixDevelop, nixSystem, nixSystems } from '../nix/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const runs = toSteps(bunSteps).flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    // The whole job, in order: the version check, then this repository's
    // dependencies and its suite, each entering the flake. Nothing installs or
    // runs a published `functionalscript` — that check moved to the package job
    // family, which can look at the tarball this commit builds instead of a
    // release that shipped weeks ago.
    steps: () => assertStructurallySame(runs, [
        `test "$(${nixDevelop(bunJobId, 'bun --version')})" = "${bun}"`,
        nixDevelop(bunJobId, 'bun install --frozen-lockfile'),
        nixDevelop(bunJobId, 'bun test --coverage'),
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
    // The one job whose shell is not the pinned snapshot's. Every part of that
    // exception is asserted here, because each half is silent on its own: an
    // override naming the wrong attribute would leave the snapshot's Bun in the
    // shell, and a `packages` entry beside it would put both on `PATH`.
    nixJob: () => {
        assertEq(bunNixJob.id, bunJobId)
        assertStructurallySame(bunNixJob.systems, nixSystems)
        assertEq(bunNixJob.packages.length, 0)
        assertEq(bunNixJob.rust, undefined)
        assertEq(bunNixJob.shellHook, undefined)
        const { pin } = bunNixJob
        assert(pin !== undefined, 'expected a pinned release')
        assertEq(pin.package, 'bun')
        assertEq(pin.version, bun)
        // One archive per declared system and no others: a source the flake
        // never reads is a hash nobody checks, and a system with none would
        // fail at generation instead of here.
        assertStructurallySame(Object.keys(pin.sources), [...bunNixJob.systems])
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
