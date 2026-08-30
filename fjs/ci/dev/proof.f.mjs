import { devJobId, devNixJob, devSystems } from './module.f.mjs'
import { bunPin } from '../bun/module.f.mjs'
import { major, nodeNixJobs } from '../node/module.f.mjs'
import { wasmPackages, wasmRust } from '../rust/module.f.mjs'
import { node } from '../config/module.f.mjs'
import { nixShell, nixSystem } from '../nix/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

export const proof = {
    // Four systems, and `git` — the two things this declaration has that no CI
    // job needs. Both are the point of it: a shell that runs on one machine, or
    // one a developer leaves to find `git`, is not a developer environment,
    // and this shell is the developer environment as well as the jobs'.
    shape: () => {
        assertEq(devJobId, nixShell)
        assertEq(devNixJob.id, nixShell)
        assertStructurallySame([...devNixJob.systems], [...devSystems])
        assertStructurallySame([...devSystems], [
            'aarch64-linux',
            'x86_64-linux',
            'aarch64-darwin',
            'x86_64-darwin',
        ])
        // The runner CI has is among them, since every job but two enters this
        // shell from it.
        assert(devSystems.includes(nixSystem), nixSystem)
        assert(devNixJob.packages.includes('git'), devNixJob.packages.join(' '))
        // A pinned archive for every system, and no others: an entry the flake
        // never reads is a hash nobody checks.
        const { pin } = devNixJob
        assert(pin !== undefined, 'expected a pinned release')
        assertStructurallySame(Object.keys(pin.sources), [...devSystems])
    },
    // The one fact the whole arrangement turns on: this shell has exactly one
    // `node`, and it is the default. That is why `node26` can run here — its
    // `npm ci` and `npm run cov` resolve `node` from `PATH` and find the
    // release they want — and why Node 22 and Node 24 cannot, which is what
    // their own flakes below are.
    //
    // A second `nodejs_*` here would be worse than useless: `mkShell` puts both
    // on `PATH` and one wins silently.
    oneNodeAndItIsTheDefault: () => {
        const nodes = devNixJob.packages.filter(p => p.startsWith('nodejs_'))
        assertStructurallySame(nodes, [`nodejs_${major(node.default)}`])
        // The versions that had to keep a flake are exactly the ones this shell
        // cannot serve.
        assertStructurallySame(
            nodeNixJobs.map(job => job.id),
            [node.node22, node.node24].map(v => `node${major(v)}`))
        assert(
            !nodeNixJobs.some(job => job.id === `node${major(node.default)}`),
            'the default Node needs no flake of its own')
    },
    // Nothing here is a second copy. Each tool arrives from the module that
    // owns the commands using it — the Bun override from `../bun`, the
    // toolchain and the WASM runtimes from `../rust` — so a job changing what
    // it needs changes this shell with it, rather than drifting from it.
    //
    // Identity rather than equality: a structurally equal copy would satisfy a
    // comparison and still be a second place to edit.
    takesEachToolFromItsOwner: () => {
        assert(devNixJob.rust === wasmRust, 'expected the wasm toolchain itself')
        for (const name of wasmPackages) {
            assert(devNixJob.packages.includes(name), name)
        }
        assertStructurallySame(devNixJob.pin, bunPin(devSystems))
    },
}
