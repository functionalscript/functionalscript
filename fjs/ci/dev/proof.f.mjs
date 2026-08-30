import { devJobId, devNixJob, devSteps, devSystems } from './module.f.mjs'
import { bunNixJob } from '../bun/module.f.mjs'
import { denoNixJob } from '../deno/module.f.mjs'
import { wasmNixJob } from '../rust/module.f.mjs'
import { major, nodeNixJobs } from '../node/module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { bun, deno, node, wasmer, wasmtime } from '../config/module.f.mjs'
import { nixDevelop, nixSystem } from '../nix/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const runs = toSteps(devSteps).flatMap(s => s.run !== undefined ? [s.run] : [])

/** @type {(id: string, command: string, expected: string) => string} */
const check = (id, command, expected) =>
    `test "$(${nixDevelop(id, command)})" = "${expected}"`

export const proof = {
    // The shell is the union of what the jobs use, and it is *the same* union
    // rather than a second copy of it. Each of these compares the developer
    // environment against the job it came from, so a job changing its runtime
    // without the shell following fails here rather than on someone's machine.
    noDrift: () => {
        // Rust: byte for byte the `wasm` job's toolchain, targets included. A
        // developer who cannot build what CI builds has the wrong shell.
        assertStructurallySame(devNixJob.rust, wasmNixJob.rust)
        // Bun: the same override, over four systems instead of one. Only the
        // per-system archives differ, which is what `sources` is for.
        const { pin } = devNixJob
        const bunPinned = bunNixJob.pin
        assert(pin !== undefined && bunPinned !== undefined, 'expected both pins')
        assertEq(pin.package, bunPinned.package)
        assertEq(pin.version, bunPinned.version)
        assertEq(pin.version, bun)
        // Node: the version the canonical Node job runs, by the same mapping
        // from version to package attribute that job uses.
        const [newest] = nodeNixJobs.filter(job => job.id === `node${major(node.default)}`)
        assert(newest !== undefined, 'expected the default Node job')
        assert(
            devNixJob.packages.includes(`nodejs_${major(node.default)}`),
            devNixJob.packages.join(' '))
        assertStructurallySame([...newest.packages], [`nodejs_${major(node.default)}`])
        // Deno and the two WASM runtimes, by attribute rather than version:
        // those are the names their own jobs declare.
        for (const name of [...denoNixJob.packages, ...wasmNixJob.packages]) {
            assert(devNixJob.packages.includes(name), name)
        }
    },
    // Four systems, and `git` — the two things this declaration has that no CI
    // job does. Both are the point of it: a shell that runs on one machine, or
    // one a developer leaves to find `git`, is not a developer environment.
    shape: () => {
        assertEq(devNixJob.id, devJobId)
        assertStructurallySame([...devNixJob.systems], [...devSystems])
        assertStructurallySame([...devSystems], [
            'aarch64-linux',
            'x86_64-linux',
            'aarch64-darwin',
            'x86_64-darwin',
        ])
        // The runner CI has is among them, since the `dev` job enters this
        // shell from it.
        assert(devSystems.includes(nixSystem), nixSystem)
        assert(devNixJob.packages.includes('git'), devNixJob.packages.join(' '))
        // A pinned archive for every system, and no others: an entry the flake
        // never reads is a hash nobody checks.
        const { pin } = devNixJob
        assert(pin !== undefined, 'expected a pinned release')
        assertStructurallySame(Object.keys(pin.sources), [...devSystems])
    },
    // The job, step for step: every version the shell hands a developer, then
    // one plain command. Rust is absent for the reason it is absent from
    // `wasm`'s checks — the flake names the release in full — and the plain
    // command is what makes this a job that *enters* the shell rather than one
    // that only reads versions out of substitutions.
    steps: () => assertStructurallySame(runs, [
        check(devJobId, 'node --version', `v${node.default}`),
        check(devJobId, `deno eval 'console.log(Deno.version.deno)'`, deno),
        check(devJobId, 'bun --version', bun),
        check(devJobId, 'wasmtime --version', `wasmtime ${wasmtime}`),
        check(devJobId, 'wasmer --version', `wasmer ${wasmer}`),
        nixDevelop(devJobId, 'git --version'),
    ]),
    // No `cargo`, deliberately: these steps are generated for whatever project
    // runs `fjs ci`, and one without a `Cargo.toml` gets no Rust jobs and must
    // get no Rust commands.
    noCargo: () => assert(
        !runs.some(run => run.includes('cargo')),
        'unexpected cargo command in a job generated for every project'),
    installsNixOnly: () => {
        const used = toSteps(devSteps).flatMap(s => s.uses !== undefined ? [s.uses] : [])
        assertStructurallySame(
            used.filter(u => !u.startsWith('actions/checkout@')),
            used.filter(u => u.startsWith('cachix/install-nix-action@')))
    },
}
