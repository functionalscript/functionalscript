/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * per-version canonical jobs.
 *
 * @module
 *
 * @import { Job, Jobs, MetaStep, Step } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { node } from '../config/module.f.mjs'
import { install, test, ubuntuArm, uses } from '../common/module.f.mjs'
import { nixInstall, nixVersionCheckStep } from '../nix/module.f.mjs'

/**
 * Name of the CI artifact carrying the `npm pack` tarball. The producing step
 * is below; a consuming job downloads it by this name.
 */
export const packageArtifact = /** @type {const} */ ('package-tarball')

/** @type {(v: string) => string} */
export const major = v => v.split('.')[0]

/** @type {(version: string) => string} */
const jobId = version => `node${major(version)}`

/** @type {(v: string) => Step} */
const installNode = v =>
    uses('actions/setup-node', { 'node-version': v })

/** @type {(v: string) => readonly MetaStep[]} */
const nodeInstall = v => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
]

/** @type {(version: string) => (extra: readonly MetaStep[]) => readonly MetaStep[]} */
export const basicNode = version => extra => [
    ...nodeInstall(version),
    ...extra,
]

/** @type {(version: string) => MetaStep} */
const fjsGlobalInstall = version =>
    install({ run: `npm install -g functionalscript@${version}` })

/** @type {(version: string) => readonly MetaStep[]} */
export const platformNodeSteps = version => [
    ...nodeInstall(node.default),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
]

/** @type {(version: string) => readonly MetaStep[]} */
const node22Steps = version => [
    ...nodeInstall(node.node22),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
    test({ run: 'node --test' }),
]

/** @type {readonly MetaStep[]} */
const node24Steps = [
    ...nodeInstall(node.node24),
    test({ run: 'node --test' }),
]

/** @type {readonly MetaStep[]} */
const node26Steps = [
    ...nodeInstall(node.default),
    test({ run: 'npm run ci-update' }),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    // No authored `.mjs` may contain a file-scope JSDoc `@typedef` (root
    // `AGENTS.md`); `tsc` accepts one silently, so the prohibition needs its
    // own gate.
    test({ run: "! grep -rnE '^(/\\*\\*.*@typedef|\\s\\* *@typedef)' --include='*.mjs' --exclude-dir=node_modules ." }),
    // `@module` belongs to a package entry point and nowhere else
    // (`fjs/AGENTS.md` §2). Both directions are checked: the tag drifted onto
    // 102 `types.ts`/proof files before anything looked, and a check for only
    // that half would also pass on a tree that had lost the tag everywhere.
    // `grep -L` cannot carry the verdict in its exit status — it reports
    // whether any file *matched*, not whether it listed one — so the second
    // guard pipes into `grep -q .` instead.
    test({ run: "! grep -rl @module --include='*.ts' --include='*.mjs' --exclude-dir=node_modules . | grep -qvE '(^|/)module\\.(f\\.)?mjs$'" }),
    test({ run: "! git ls-files | grep -E '(^|/)module\\.(f\\.)?mjs$' | xargs grep -L @module | grep -q ." }),
    test({ run: 'npx tsc' }),
    test({ run: 'npm run cov' }),
    test({ run: 'npm pack' }),
    // Hands the tarball to a job that has no checkout, which is the only place
    // the package can be checked as a consumer sees it. `if-no-files-found`
    // must be `error`: the default warns and uploads nothing, so a consuming
    // job would fail later on a missing artifact rather than here on the real
    // cause.
    test(uses('actions/upload-artifact', {
        name: packageArtifact,
        path: '*.tgz',
        'if-no-files-found': 'error',
    })),
]

/** @type {(steps: readonly MetaStep[]) => Job} */
const nodeJob = steps => ubuntuArm(steps)

/** @type {(version: string) => Jobs} */
export const nodeVersionJobs = version => ({
    [jobId(node.node22)]: nodeJob(node22Steps(version)),
    [jobId(node.node24)]: nodeJob(node24Steps),
    [jobId(node.default)]: nodeJob(node26Steps),
})

// The canonical Node jobs run on the Ubuntu ARM runner.
export const nixSystem = /** @type {const} */ ('aarch64-linux')

// Keeps `npm install -g functionalscript` writable and puts the installed `fjs`
// on `PATH` for the rest of the same `nix develop` invocation.
const npmGlobalShellHook = /** @type {const} */ (`export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`)

// Versions of the canonical Node jobs, in job order.
const nixVersions = /** @type {const} */ ([node.node22, node.node24, node.default])

/** @type {(version: string) => NixJob} */
const nixJob = version => ({
    id: jobId(version),
    system: nixSystem,
    packages: [`nodejs_${major(version)}`],
})

/** Generated development environments for the canonical Node jobs.
 *
 * @type {readonly NixJob[]}
 */
export const nodeNixJobs = [
    { ...nixJob(node.node22), shellHook: npmGlobalShellHook },
    nixJob(node.node24),
    nixJob(node.default),
]

/**
 * Version-check steps for the canonical Node jobs' generated flakes, one per
 * job. Collected into the shared temporary `nix-flakes` job in
 * `fjs/ci/module.f.mjs`.
 *
 * @type {readonly MetaStep[]}
 */
export const nodeNixVersionSteps =
    nixVersions.map(version => nixVersionCheckStep(jobId(version), version))

/**
 * Temporary job that instantiates every generated flake.
 *
 * Nothing else in CI evaluates the generated files, so a broken flake — or one
 * whose snapshot moved to a different Node — would only surface once a real job
 * started using it. It deliberately stays separate from the canonical Node jobs:
 * those keep their current `setup-node` runtime until they are migrated one at a
 * time. When the last one migrates and this job goes away, each migrated job
 * must check its own Node version inside the `nix develop` invocation, or the
 * guarantee is lost.
 *
 * @type {Job}
 */
export const nodeNixFlakeJob = ubuntuArm([
    nixInstall,
    ...nodeNixVersionSteps,
])

export const nodeMainSteps = platformNodeSteps
