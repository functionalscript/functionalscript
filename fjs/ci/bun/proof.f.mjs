import { bunPin, bunSteps } from './module.f.mjs'
import { bun, bunSources } from '../config/module.f.js'
import { nixDevelop, nixSystem } from '../nix/module.f.mjs'
import { _migratedJobChecks, _runs } from '../nix/testlib.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'

const runs = _runs(bunSteps)

export const proof = {
    // The whole job, in order: the version check, then this repository's
    // dependencies and its suite, each entering the flake. Nothing installs or
    // runs a published `functionalscript`. That check is owed beside the
    // packed-package check (`../todo/built-package-checks.md`), where it can
    // look at the tarball this commit builds instead of a release that shipped
    // weeks ago.
    steps: () => assertStructurallySame(runs, [
        `test "$(${nixDevelop('bun --version')})" = "${bun}"`,
        nixDevelop('bun install --frozen-lockfile'),
        nixDevelop('bun test --coverage'),
    ]),
    // The all-Nix migration's contract. The job has no flake of its own: every
    // command names `bun`, so what else the shared shell carries cannot decide
    // what runs them.
    ..._migratedJobChecks({ steps: bunSteps, retiredAction: 'oven-sh/setup-bun' }),
    // The pin covers whatever systems it is asked for, and each entry names the
    // release the job checks for and the archive that system's packaging
    // expects. Both come from the configured table.
    pinSources: () => {
        const { sources } = bunPin(['aarch64-linux', 'aarch64-darwin'])
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
            ['aarch64-linux', 'aarch64-darwin'])
        assertEq(nixSystem, 'aarch64-linux')
    },
}
