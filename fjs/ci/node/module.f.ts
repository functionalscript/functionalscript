/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * per-version canonical jobs.
 *
 * @module
 */
import { node } from '../config/module.f.mjs'
import { type Job, type Jobs, type MetaStep, install, test, ubuntuArm, uses } from '../common/module.f.ts'
import { nixInstall, nixVersionCheckStep, type NixJob } from '../nix/module.f.ts'

export const major = (v: string): string => v.split('.')[0]

const jobId = (version: string): string => `node${major(version)}`

const installNode = (version: string) =>
    uses('actions/setup-node', { 'node-version': version })

const nodeInstall = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
]

export const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => [
    ...nodeInstall(version),
    ...extra,
]

const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

export const platformNodeSteps = (version: string): readonly MetaStep[] => [
    ...nodeInstall(node.default),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
]

const node22Steps = (version: string): readonly MetaStep[] => [
    ...nodeInstall(node.node22),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
    test({ run: 'node --test' }),
]

const node24Steps: readonly MetaStep[] = [
    ...nodeInstall(node.node24),
    test({ run: 'node --test' }),
]

const node26Steps: readonly MetaStep[] = [
    ...nodeInstall(node.default),
    test({ run: 'npm run ci-update' }),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    test({ run: 'npx tsc' }),
    test({ run: 'npm run cov' }),
    test({ run: 'npm pack' }),
]

const nodeJob = (steps: readonly MetaStep[]): Job => ubuntuArm(steps)

export const nodeVersionJobs = (version: string): Jobs => ({
    [jobId(node.node22)]: nodeJob(node22Steps(version)),
    [jobId(node.node24)]: nodeJob(node24Steps),
    [jobId(node.default)]: nodeJob(node26Steps),
})

// The canonical Node jobs run on the Ubuntu ARM runner.
export const nixSystem = 'aarch64-linux' as const

// Keeps `npm install -g functionalscript` writable and puts the installed `fjs`
// on `PATH` for the rest of the same `nix develop` invocation.
const npmGlobalShellHook = `export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"` as const

// Versions of the canonical Node jobs, in job order.
const nixVersions = [node.node22, node.node24, node.default] as const

const nixJob = (version: string): NixJob => ({
    id: jobId(version),
    system: nixSystem,
    packages: [`nodejs_${major(version)}`],
})

/** Generated development environments for the canonical Node jobs. */
export const nodeNixJobs: readonly NixJob[] = [
    { ...nixJob(node.node22), shellHook: npmGlobalShellHook },
    nixJob(node.node24),
    nixJob(node.default),
]

/**
 * Version-check steps for the canonical Node jobs' generated flakes, one per
 * job. Collected into the shared temporary `nix-flakes` job in
 * `fjs/ci/module.f.ts`.
 */
export const nodeNixVersionSteps: readonly MetaStep[] =
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
 */
export const nodeNixFlakeJob: Job = ubuntuArm([
    nixInstall,
    ...nodeNixVersionSteps,
])

export const nodeMainSteps = platformNodeSteps
