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
import { nixDevelopAll, nixInstall, nodeVersionCheck, nixVersionCheckStep } from '../nix/module.f.mjs'

/**
 * Name of the CI artifact carrying the `npm pack` tarball. The producing step
 * is below; a consuming job downloads it by this name.
 */
export const packageArtifact = /** @type {const} */ ('package-tarball')

/** @type {(v: string) => string} */
export const major = v => v.split('.')[0]

/** @type {(version: string) => string} */
const jobId = version => `node${major(version)}`

/**
 * The job that packs the tarball and uploads it. A consuming job names this in
 * `needs` rather than repeating the id.
 */
export const packageJobId = jobId(node.default)

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

/**
 * The first job migrated off `setup-node`: it runs through its own generated
 * flake, so the runtime it tests on is the pinned Nixpkgs snapshot rather than
 * whatever the runner installs.
 *
 * The whole sequence is one `nix develop` invocation, so the shell's Node
 * reaches every command without exporting a profile between GitHub Actions
 * steps. It checks that Node itself first: nothing else ties this job's
 * runtime to the version `setup-node` gives the other jobs.
 *
 * @type {readonly MetaStep[]}
 */
const node24NixSteps = [
    nixInstall,
    test({
        run: nixDevelopAll(jobId(node.node24), [
            nodeVersionCheck(node.node24),
            'npm ci',
            'node --test',
        ])
    }),
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
    [jobId(node.node24)]: nodeJob(node24NixSteps),
    [jobId(node.default)]: nodeJob(node26Steps),
})

// The canonical Node jobs run on the Ubuntu ARM runner.
export const nixSystem = /** @type {const} */ ('aarch64-linux')

// Keeps `npm install -g functionalscript` writable and puts the installed `fjs`
// on `PATH` for the rest of the same `nix develop` invocation.
const npmGlobalShellHook = /** @type {const} */ (`export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`)

// Canonical Node jobs that still install their runtime with `setup-node`, in
// job order. A version leaves this list when its job migrates to `nix develop`
// and starts checking its own flake; the temporary flake job below goes away
// with the last entry.
const unmigratedVersions = /** @type {const} */ ([node.node22, node.default])

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
 * Version-check steps for the generated flakes of the Node jobs that do not run
 * through them yet, one per job. Collected into the shared temporary
 * `nix-flakes` job in `fjs/ci/module.f.mjs`.
 *
 * @type {readonly MetaStep[]}
 */
export const nodeNixVersionSteps =
    unmigratedVersions.map(version => nixVersionCheckStep(jobId(version), version))

/**
 * Temporary job that instantiates every flake no job runs through yet.
 *
 * Nothing else in CI evaluates those files, so a broken flake — or one whose
 * snapshot moved to a different Node — would only surface once a real job
 * started using it. It deliberately stays separate from the canonical Node
 * jobs: the ones still on `setup-node` keep it until they are migrated one at a
 * time. Each migrated job checks its own Node version inside its `nix develop`
 * invocation, which is what lets this job shrink to nothing and go away without
 * losing the guarantee.
 *
 * @type {Job}
 */
export const nodeNixFlakeJob = ubuntuArm([
    nixInstall,
    ...nodeNixVersionSteps,
])

export const nodeMainSteps = platformNodeSteps
